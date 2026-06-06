/*
 * ============================================================
 * FILE    : ai_service.js
 * LAYER   : Service
 * PURPOSE : Business logic for all three AI features — Expense Planner,
 *           Purchase Advisor, Finance Chat. Owns the cache-first pattern,
 *           daily limit enforcement, financial context assembly, and
 *           all Gemini API interactions.
 * DEPENDS : @google/generative-ai, crypto, zod, decimal.js
 *           models: ai_cache_model, ai_usage_model
 *           services: analytics_service, budget_goal_service
 * ============================================================
 * EXPORTS:
 *   - plan_expenses      : Budget allocation suggestion for a target month
 *   - advise_purchase    : Can-I-afford-this verdict for a specific item
 *   - analyze_finances   : Free-form financial Q&A
 *   - get_user_ai_usage  : Today's usage stats for the requesting user
 * ============================================================
 */

// ARCHITECTURE GUARD: This file never imports PrismaClient directly.
// It calls functions from multiple model files because building
// financial context requires data from records, analytics, and
// budget goals simultaneously. This is an accepted exception
// to the single-model-per-service guideline.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const { z } = require('zod');
const Decimal = require('decimal.js');

const ai_cache_model = require('../models/ai_cache_model');
const ai_usage_model = require('../models/ai_usage_model');
const analytics_service = require('./analytics_service');
const budget_goal_service = require('./budget_goal_service');

// ─── Decimal helper ──────────────────────────────────────────────────────────
// WHY: Centralise Decimal construction so null/undefined values always
//      produce Decimal(0) instead of throwing on construction.
const to_decimal = (val) => new Decimal(val ?? 0);

// ─── Gemini client setup ─────────────────────────────────────────────────────
// WHY gemini-2.0-flash: latest fast model — better accuracy than 1.5-flash
//     with comparable speed. Ideal for interactive financial advice.
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini_model = genai.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    generationConfig: {
        responseMimeType: 'application/json', // force structured output — no markdown wrappers
        temperature: 0.3,                     // low temperature = consistent, factual responses
        maxOutputTokens: 2048,
    },
});

// ─── TTL constants ────────────────────────────────────────────────────────────
// WHY plan is 24h: spending patterns don't change hour-by-hour.
// WHY advise is 12h: user may add records mid-day, changing their surplus.
// WHY analyze is 1h: free-form questions vary widely; short TTL = fresher answers.
const TTL_PLAN = 24 * 60 * 60 * 1000;  // 24 hours in ms
const TTL_ADVISE = 12 * 60 * 60 * 1000;  // 12 hours in ms
const TTL_ANALYZE = 1 * 60 * 60 * 1000;  //  1 hour  in ms

// ─── Zod schemas ─────────────────────────────────────────────────────────────
// Defined at module level so they are compiled once and reused across calls.

const plan_item_schema = z.array(
    z.object({
        category_name: z.string(),
        suggested_amount: z.string(), // "500.00" — serialised decimal
        percentage: z.string(), // "20.00"  — of total budget
        reason: z.string(),
    })
);

const advise_schema = z.object({
    verdict: z.enum(['can_afford', 'wait', 'adjust_spending']),
    reasoning: z.string(),
    months_to_save: z.number().nullable().optional(),
    suggested_adjustments: z.array(z.string()).optional(),
});

const analyze_schema = z.object({
    answer: z.string(),
    key_insights: z.array(z.string()),
});

// ─────────────────────────────────────────────────────────────────────────────

/*
 * FUNCTION : build_cache_key
 * ─────────────────────────────────────────────────────────
 * WHY      : Creates a deterministic, fixed-length identifier for any
 *            combination of inputs. SHA-256 guarantees that different inputs
 *            always produce different keys, and the 64-char hex output is
 *            safe to store as the unique cache_key column.
 *
 * HOW      : 1. JSON.stringify the inputs object (deterministic key order)
 *            2. SHA-256 hash the string
 *            3. Return the 64-char hex digest
 *
 * @param   {object}  inputs  - Any serialisable object representing the request
 * @returns {string}          - 64-character hex SHA-256 hash
 * ─────────────────────────────────────────────────────────
 */
function build_cache_key(inputs) {
    const str = JSON.stringify(inputs);
    return crypto.createHash('sha256').update(str).digest('hex');
}

/*
 * FUNCTION : get_data_quality_preamble
 * ─────────────────────────────────────────────────────────
 * WHY      : Without this, Gemini invents numbers for new users
 *            (hallucination) or fails Zod validation on empty context.
 *            'none'    → no records yet, give general advice
 *            'limited' → < 10 records, note limited accuracy
 *            'good'    → full personalisation, no preamble needed
 *
 * @param   {string} data_quality
 * @returns {string}
 * ─────────────────────────────────────────────────────────
 */
function get_data_quality_preamble(data_quality) {
    if (data_quality === 'none') {
        return `IMPORTANT: This user is new and has no financial records yet.
Do NOT invent or assume any numbers.
Give general personal finance best-practice advice.
Encourage the user to add income and expense records to unlock personalised recommendations.
Keep the tone welcoming and helpful.\n`;
    }
    if (data_quality === 'limited') {
        return `NOTE: This user has limited financial history (fewer than 10 records).
Base advice on available data but note recommendations will improve with more records.
Do not extrapolate aggressively from sparse data.\n`;
    }
    return ''; // 'good' — no preamble, full personalisation
}


/*
 * FUNCTION : build_financial_context
 * ─────────────────────────────────────────────────────────
 * WHY      : Assembles the financial summary injected into every Gemini
 *            prompt. This is the most critical function in this file —
 *            if the context is wrong, all AI advice is wrong.
 *
 *            Uses analytics and budget_goal services (not raw records)
 *            because: summaries use ~200 tokens vs ~2000+ for raw rows,
 *            and the analytics layer already computed the aggregations.
 *
 * HOW      : 1. Get current month/year from system clock
 *            2. Fire all four data fetches in parallel (Promise.allSettled)
 *               so a single failure doesn't crash the whole request
 *            3. Use .value if fulfilled; safe empty fallback if rejected
 *            4. Return structured context object with amounts as strings
 *
 * @param   {string}  user_id  - Owner whose financial data to assemble
 * @returns {object}           - Financial context object for Gemini prompt
 * ─────────────────────────────────────────────────────────
 */
async function build_financial_context(user_id) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Parallel fetch — allSettled means partial failure gives partial context,
    // not a complete crash. Gemini can still give useful advice with partial data.
    const [summary, category_breakdown, monthly_trends, budget_goals] =
        await Promise.allSettled([
            analytics_service.get_summary(user_id, { month, year }),
            analytics_service.get_category_breakdown(user_id, month, year),
            analytics_service.get_monthly_trends(user_id, 3),
            budget_goal_service.get_monthly_goals(user_id, month, year),
        ]);
    // data_quality drives prompt preamble — prevents hallucination for new/sparse users
    const record_count = summary.value?.record_count ?? 0;
    const data_quality = record_count === 0 ? 'none'
        : record_count < 10 ? 'limited'
        : 'good';

    return {
        current_month: `${year}-${String(month).padStart(2, '0')}`,
        total_income: summary.value?.total_income ?? '0.00',
        total_expense: summary.value?.total_expense ?? '0.00',
        net_balance: summary.value?.net_balance ?? '0.00',
        category_spending: category_breakdown.value ?? [],
        monthly_trends: monthly_trends.value ?? [],
        budget_goals: budget_goals.value ?? [],
        has_budget_goals: (budget_goals.value?.length ?? 0) > 0,
        record_count,
        has_data: record_count > 0,
        data_quality,
    };
}

/*
 * FUNCTION : call_gemini_safe
 * ─────────────────────────────────────────────────────────
 * WHY      : Single wrapper for all Gemini API calls. Centralises
 *            try/catch around JSON.parse because Gemini occasionally
 *            wraps output in markdown fences (```json ... ```) even
 *            with responseMimeType: 'application/json' set.
 *            Also converts network errors into predictable error codes.
 *
 * HOW      : 1. Record start time for response_time_ms tracking
 *            2. Call gemini_model.generateContent(prompt)
 *            3. Extract raw text from response.response.text()
 *            4. Strip any markdown fences Gemini may have added
 *            5. JSON.parse the cleaned text
 *            6. Validate parsed JSON with the provided Zod schema
 *            7. Return { data, tokens_used, response_time_ms }
 *
 * @param   {string}     prompt      - The full prompt to send Gemini
 * @param   {ZodSchema}  zod_schema  - Validates the expected response shape
 * @returns {{ data: object, tokens_used: number|null, response_time_ms: number }}
 * @throws  {Error}  status 502  'AI_UNAVAILABLE'  if Gemini API call fails
 * @throws  {Error}  status 502  'AI_PARSE_ERROR'  if JSON is malformed
 * @throws  {Error}  status 502  'AI_SCHEMA_ERROR' if Zod validation fails
 * ─────────────────────────────────────────────────────────
 */
async function call_gemini_safe(prompt, zod_schema) {
    const start_time = Date.now();

    let response;
    try {
        response = await gemini_model.generateContent(prompt);
    } catch (err) {
        const error = new Error('AI_UNAVAILABLE: Gemini API call failed');
        error.status = 502;
        throw error;
    }

    const response_time_ms = Date.now() - start_time;
    const raw_text = response.response.text();
    const tokens_used = response.response.usageMetadata?.totalTokenCount ?? null;

    // Strip markdown fences Gemini sometimes adds despite responseMimeType setting
    const clean_text = raw_text
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

    let parsed;
    try {
        parsed = JSON.parse(clean_text);
    } catch {
        const error = new Error('AI_PARSE_ERROR: Gemini returned invalid JSON');
        error.status = 502;
        throw error;
    }

    const validated = zod_schema.safeParse(parsed);
    if (!validated.success) {
        const error = new Error('AI_SCHEMA_ERROR: Gemini response did not match expected schema');
        error.status = 502;
        throw error;
    }

    return { data: validated.data, tokens_used, response_time_ms };
}

/*
 * FUNCTION : run_with_cache
 * ─────────────────────────────────────────────────────────
 * WHY      : Implements the mandatory cache-first pattern for all three
 *            AI features. Extracted as a helper to avoid duplicating
 *            this logic in every feature function.
 *
 *            Cache hits are FREE: they bypass the daily limit check
 *            because they make no Gemini API call.
 *
 * HOW      : 1. Check AiCache for cache_key (expires_at > now)
 *            2. CACHE HIT  → increment hit_count + log usage (cached)
 *                          → return { data, is_cache_hit: true }
 *            3. CACHE MISS → count today's non-cached requests for user
 *            4.              If count >= daily_limit → throw 429 with reset_at
 *            5.              Call gemini_fn() — the actual Gemini call
 *            6.              Save to AiCache with expires_at = now + ttl_ms
 *            7.              Log usage (was_cached: false, tokens_used)
 *            8.              Return { data, is_cache_hit: false }
 *
 * @param   {object}    options
 * @param   {string}    options.cache_key     - SHA-256 hash of request inputs
 * @param   {AiFeature} options.feature_name  - Prisma enum value
 * @param   {string}    options.user_id       - Requesting user's ID
 * @param   {number}    options.daily_limit   - From req.user.ai_daily_limit
 * @param   {number}    options.ttl_ms        - Cache lifetime in milliseconds
 * @param   {Function}  options.gemini_fn     - async () => { data, tokens_used }
 * @returns {{ data: object, is_cache_hit: boolean }}
 * @throws  {Error}     status 429 if non-cached daily limit is exceeded
 * ─────────────────────────────────────────────────────────
 */
async function run_with_cache({ cache_key, feature_name, user_id,
    daily_limit, ttl_ms, gemini_fn }) {

    // Step 1 — Check cache before anything else
    const cached = await ai_cache_model.find_by_key(cache_key);

    if (cached) {
        // Cache hit — serve without any limit check or API call.
        // WHY allSettled: if increment_hit fails (rare DB hiccup), we still
        //     want log_usage to record the request. allSettled never short-circuits.
        await Promise.allSettled([
            ai_cache_model.increment_hit(cached.id),
            ai_usage_model.log_usage(user_id, feature_name, true, null),
        ]);
        return { data: JSON.parse(cached.response_json), is_cache_hit: true };
    }

    // Step 2 — Enforce daily limit only for non-cached (real API) requests
    const today_count = await ai_usage_model.count_today_non_cached(user_id);
    if (today_count >= daily_limit) {
        const reset_at = new Date();
        reset_at.setHours(24, 0, 0, 0); // resets at midnight tonight

        const err = new Error('Daily AI limit reached');
        err.status = 429;
        err.reset_at = reset_at.toISOString();
        err.used = today_count;
        err.limit = daily_limit;
        throw err;
    }

    // Step 3 — Call Gemini (via the feature-specific gemini_fn)
    const { data, tokens_used } = await gemini_fn();

    // Step 4 — Persist response in cache with correct TTL
    const expires_at = new Date(Date.now() + ttl_ms);
    await ai_cache_model.create_entry(
        cache_key, feature_name, JSON.stringify(data), user_id, expires_at
    );

    // Step 5 — Log this billable API call
    await ai_usage_model.log_usage(user_id, feature_name, false, tokens_used);

    return { data, is_cache_hit: false };
}

/*
 * FUNCTION : plan_expenses
 * ─────────────────────────────────────────────────────────
 * WHY      : Users want AI to suggest how to allocate a target budget
 *            across categories based on their actual spending history.
 *            If the user already has goals for the target month, Gemini
 *            can see them and suggest adjustments rather than starting
 *            from scratch — giving personalised, not generic, advice.
 *
 * HOW      : 1. Build cache_key from user_id + "plan" + target_budget + month + year
 *            2. Build financial context (current-month summary + 3-month trends)
 *            3. Separately fetch target month's existing budget goals
 *               (may differ from current month if planning ahead)
 *            4. Build prompt injecting context + target budget + any existing goals
 *            5. Call run_with_cache with TTL_PLAN (24h)
 *            6. Return { data: category allocation array, is_cache_hit }
 *
 * @param   {string}  user_id      - Requesting user's ID
 * @param   {number}  daily_limit  - From req.user.ai_daily_limit
 * @param   {object}  options
 * @param   {string}  options.target_budget  - Total budget to allocate e.g. "2500"
 * @param   {number}  options.month          - Target month (1–12)
 * @param   {number}  options.year           - Target year e.g. 2026
 * @returns {{ data: PlanItem[], is_cache_hit: boolean }}
 * ─────────────────────────────────────────────────────────
 */
async function plan_expenses(user_id, daily_limit, { target_budget, month, year }) {
    const cache_key = build_cache_key({ user_id, feature: 'plan', target_budget, month, year });

    return run_with_cache({
        cache_key,
        feature_name: 'plan_expenses',
        user_id,
        daily_limit,
        ttl_ms: TTL_PLAN,
        gemini_fn: async () => {
            // Build current-month context for historical reference
            const financial_context = await build_financial_context(user_id);
            const preamble = get_data_quality_preamble(financial_context.data_quality);

            // Fetch target month goals separately — user may be planning ahead
            const target_goals = await budget_goal_service.get_monthly_goals(user_id, month, year);

            const month_name = new Date(year, month - 1, 1)
                .toLocaleString('en-US', { month: 'long' });

            const existing_goals_block = target_goals.length > 0
                ? `\nExisting budget goals for ${month_name} ${year}:\n${JSON.stringify(target_goals, null, 2)}`
                : `\nNo existing budget goals set for ${month_name} ${year}.`;

            const prompt = `${preamble}
You are a personal financial advisor. Analyse the user's financial data and suggest
how to allocate their total budget of ${target_budget} for ${month_name} ${year}.

FINANCIAL CONTEXT (last 3 months of activity):
${JSON.stringify(financial_context, null, 2)}
${existing_goals_block}

INSTRUCTIONS:
- Return a JSON array of category allocation objects.
- Base suggestions on the user's actual spending history in category_spending and monthly_trends.
- If a category shows the user is consistently over budget, flag this in the reason field.
- Allocations must sum to exactly ${target_budget}.
- Each amount must be a string formatted as "0.00".
- Use the exact category_name strings from the context — never use IDs.
- Return ONLY a valid JSON array with no other text, preamble, or markdown.

REQUIRED JSON SHAPE (array of objects):
[
  {
    "category_name": "Food",
    "suggested_amount": "500.00",
    "percentage": "20.00",
    "reason": "Based on your average monthly food spend of $480..."
  }
]
`;
            return call_gemini_safe(prompt, plan_item_schema);
        },
    });
}

/*
 * FUNCTION : advise_purchase
 * ─────────────────────────────────────────────────────────
 * WHY      : Users want a concrete yes/no/wait answer before a purchase.
 *            With saved budget goals, Gemini can give specific feedback like:
 *            "You budgeted $500 for Food; $20 remains — this would exceed by $230."
 *            Without goals, it can only compare against raw income/expense.
 *
 * HOW      : 1. Build cache_key from user_id + "advise" + item_name + item_cost + month + year
 *               item_name is included because same cost ≠ same category
 *               ("Laptop $1200" vs "Vacation $1200" affect different budget areas)
 *            2. Build financial context
 *            3. Build prompt with item details + current surplus + relevant goals
 *            4. Call run_with_cache with TTL_ADVISE (12h)
 *            5. Return { data: verdict object, is_cache_hit }
 *
 * @param   {string}  user_id      - Requesting user's ID
 * @param   {number}  daily_limit  - From req.user.ai_daily_limit
 * @param   {object}  options
 * @param   {string}  options.item_name     - What the user wants to buy
 * @param   {string}  options.item_cost     - Cost as a string e.g. "1200.00"
 * @param   {string}  options.planned_date  - ISO date string e.g. "2026-06-15"
 * @returns {{ data: { verdict, reasoning, months_to_save?, suggested_adjustments? }, is_cache_hit }}
 * ─────────────────────────────────────────────────────────
 */
async function advise_purchase(user_id, daily_limit, { item_name, item_cost, planned_date }) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const cache_key = build_cache_key({ user_id, feature: 'advise', item_name, item_cost, month, year });

    return run_with_cache({
        cache_key,
        feature_name: 'advise_purchase',
        user_id,
        daily_limit,
        ttl_ms: TTL_ADVISE,
        gemini_fn: async () => {
            const financial_context = await build_financial_context(user_id);
            let preamble = get_data_quality_preamble(financial_context.data_quality);
            // Force 'wait' verdict when there's no data — Gemini cannot assess affordability
            if (financial_context.data_quality === 'none') {
                preamble += `\nFor the verdict field you MUST return "wait".
In reasoning, explain you cannot assess affordability without financial records.\n`;
            }


            // Calculate current surplus using decimal.js for accuracy
            const surplus = to_decimal(financial_context.net_balance).toFixed(2);
            const cost = to_decimal(item_cost).toFixed(2);

            const prompt = `${preamble}
You are a personal financial advisor. Assess whether the user can afford the following purchase.

PURCHASE REQUEST:
- Item: ${item_name}
- Cost: $${cost}
- Planned date: ${planned_date ?? 'as soon as possible'}

FINANCIAL CONTEXT (current month: ${financial_context.current_month}):
${JSON.stringify(financial_context, null, 2)}

Current monthly surplus (income - expenses so far): $${surplus}

INSTRUCTIONS:
- verdict must be exactly one of: "can_afford", "wait", "adjust_spending"
- can_afford: surplus clearly covers the cost and budget goals are not threatened
- wait: surplus is insufficient but achievable within 1-3 months of saving
- adjust_spending: possible if the user cuts back in specific categories
- If budget_goals exist, check whether this purchase would exceed relevant category budgets
- Be specific — reference actual numbers from the context in your reasoning
- Return ONLY a valid JSON object matching the schema below, no markdown, no preamble.

REQUIRED JSON SHAPE:
{
  "verdict": "can_afford",
  "reasoning": "Your current surplus of $${surplus} comfortably covers $${cost}...",
  "months_to_save": null,
  "suggested_adjustments": []
}
`;
            return call_gemini_safe(prompt, advise_schema);
        },
    });
}

/*
 * FUNCTION : analyze_finances
 * ─────────────────────────────────────────────────────────
 * WHY      : Free-form Q&A lets users discover insights they didn't
 *            know to ask for specifically. Unlike the planner or advisor,
 *            there is no predefined output shape — users ask anything.
 *
 * HOW      : 1. Sanitise question: strip HTML tags, trim, collapse whitespace,
 *               enforce 500-char max to prevent prompt injection
 *            2. Build cache_key from user_id + "analyze" + normalised question
 *               Normalise: lowercase + trim + collapse whitespace
 *            3. Build full financial context
 *            4. Build prompt: inject context + user question
 *            5. Call run_with_cache with TTL_ANALYZE (1h — short because
 *               the user's finances change during the day)
 *            6. Return { data: { answer, key_insights[] }, is_cache_hit }
 *
 * @param   {string}  user_id      - Requesting user's ID
 * @param   {number}  daily_limit  - From req.user.ai_daily_limit
 * @param   {string}  question     - Raw user question (will be sanitised here)
 * @returns {{ data: { answer: string, key_insights: string[] }, is_cache_hit: boolean }}
 * ─────────────────────────────────────────────────────────
 */
async function analyze_finances(user_id, daily_limit, question) {
    // Sanitise input — strip HTML, normalise whitespace, enforce length cap
    const sanitised = question
        .replace(/<[^>]*>/g, '')    // strip HTML tags
        .trim()
        .replace(/\s+/g, ' ')       // collapse multiple spaces
        .slice(0, 500);             // hard cap to prevent oversized prompts

    // Normalise for cache key — same question with different casing = same cache entry
    const normalised = sanitised.toLowerCase();
    const cache_key = build_cache_key({ user_id, feature: 'analyze', question: normalised });

    return run_with_cache({
        cache_key,
        feature_name: 'analyze_finances',
        user_id,
        daily_limit,
        ttl_ms: TTL_ANALYZE,
        gemini_fn: async () => {
            const financial_context = await build_financial_context(user_id);
            const preamble = get_data_quality_preamble(financial_context.data_quality);

            const prompt = `${preamble}
You are a personal financial advisor with full access to the user's financial data.
Answer the user's question using only the data provided — do not make up figures.

FINANCIAL CONTEXT:
${JSON.stringify(financial_context, null, 2)}

USER QUESTION:
"${sanitised}"

INSTRUCTIONS:
- Answer concisely but with specific numbers from the context where relevant
- key_insights should be 2–4 short, actionable bullet-point strings
- If the question cannot be answered from the available data, say so clearly in the answer
- Return ONLY a valid JSON object, no markdown, no preamble.

REQUIRED JSON SHAPE:
{
  "answer": "Your biggest expense category this month is...",
  "key_insights": [
    "Food spending is 15% above your 3-month average",
    "Your net balance is positive — you are saving money"
  ]
}
`;
            return call_gemini_safe(prompt, analyze_schema);
        },
    });
}

/*
 * FUNCTION : get_user_ai_usage
 * ─────────────────────────────────────────────────────────
 * WHY      : Shown in the AiAssistantPage header so users can see
 *            "3 of 10 AI requests used today" and "2 served from cache"
 *            before they unexpectedly hit the 429 daily limit.
 *
 * HOW      : 1. Call ai_usage_model.get_usage_for_user(user_id)
 *            2. Calculate remaining = daily_limit - non_cached_today
 *            3. Return all four fields for flexible UI display
 *
 * @param   {string}  user_id      - Requesting user's ID
 * @param   {number}  daily_limit  - From req.user.ai_daily_limit
 * @returns {{ non_cached_today: number, cached_today: number, daily_limit: number, remaining: number }}
 * ─────────────────────────────────────────────────────────
 */
async function get_user_ai_usage(user_id, daily_limit) {
    const { non_cached_today, cached_today } =
        await ai_usage_model.get_usage_for_user(user_id);

    const remaining = Math.max(0, daily_limit - non_cached_today);

    return { non_cached_today, cached_today, daily_limit, remaining };
}

module.exports = {
    plan_expenses,
    advise_purchase,
    analyze_finances,
    get_user_ai_usage,
};