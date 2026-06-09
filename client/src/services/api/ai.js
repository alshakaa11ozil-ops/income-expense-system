/*
 * ============================================================
 * FILE    : api/ai.js
 * LAYER   : Service (HTTP — AI domain)
 * PURPOSE : All API calls for the /ai/* endpoints.
 *           Wraps the three Gemini features and the usage counter.
 *           Server handles context injection, caching, and rate
 *           limiting — this layer is intentionally thin.
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - ai_plan_expenses    : POST /ai/plan
 *   - ai_advise_purchase  : POST /ai/advise
 *   - ai_analyze_finances : POST /ai/analyze
 *   - get_ai_usage        : GET  /ai/usage
 * ============================================================
 */

import api from './client'

/*
 * FUNCTION : ai_plan_expenses
 * ─────────────────────────────────────────────────────────
 * WHY      : Calls Gemini (via backend) to suggest a monthly
 *            budget allocation based on the user's past spending.
 *            The backend injects full financial context — we only
 *            send the parameters the user entered.
 *
 * HOW      : 1. POST /ai/plan with target_budget, month, year
 *            2. Backend checks cache, enforces daily limit,
 *               calls Gemini, validates with Zod, stores cache
 *            3. Return the plan array directly
 *
 * @param   {string} target_budget - raw string from input (backend parses)
 * @param   {number} month         - 1–12
 * @param   {number} year          - e.g. 2026
 * @returns {PlanItem[]}
 *   [{ category_name, category_id, suggested_amount,
 *      percentage, reason }]
 * @throws  429 { error, reset_at, used, limit } — daily limit hit
 * @throws  502 { error, code: 'AI_UNAVAILABLE' | 'AI_PARSE_ERROR' }
 * @throws  400 — past month or more than 3 months ahead
 * ─────────────────────────────────────────────────────────
 */
export async function ai_plan_expenses(target_budget, month, year) {
    const response = await api.post('/ai/plan', { target_budget, month, year })
    return response.data.data
}

/*
 * FUNCTION : ai_advise_purchase
 * ─────────────────────────────────────────────────────────
 * WHY      : Calls Gemini to assess whether a planned purchase
 *            is affordable given the user's current balance and
 *            spending patterns. The enum verdict makes the frontend
 *            rendering deterministic — no natural language parsing.
 *
 * HOW      : 1. POST /ai/advise with item details
 *            2. Backend injects financial context, calls Gemini
 *            3. Return structured verdict object
 *
 * @param   {string} item_name    - e.g. "MacBook Pro"
 * @param   {string} item_cost    - numeric string, already sanitized
 * @param   {string} planned_date - "YYYY-MM-DD"
 * @returns {{ verdict, reasoning, months_to_save?, suggested_adjustments? }}
 *   verdict: 'can_afford' | 'wait' | 'adjust_spending'
 * @throws  429 | 502 — same shapes as ai_plan_expenses
 * ─────────────────────────────────────────────────────────
 */
export async function ai_advise_purchase(item_name, item_cost, planned_date) {
    const response = await api.post('/ai/advise', { item_name, item_cost, planned_date })
    return response.data.data
}

/*
 * FUNCTION : ai_analyze_finances
 * ─────────────────────────────────────────────────────────
 * WHY      : Free-form financial Q&A. The user types a natural
 *            language question; the backend injects their full
 *            financial context before forwarding to Gemini.
 *            key_insights are extracted as a structured array so
 *            the chat bubble can render them as a bullet list
 *            without parsing the answer string.
 *
 * HOW      : 1. POST /ai/analyze with { question }
 *            2. Return { answer, key_insights }
 *
 * @param   {string} question - the user's free-form question
 * @returns {{ answer: string, key_insights: string[] }}
 * @throws  429 | 502 — same shapes as ai_plan_expenses
 * ─────────────────────────────────────────────────────────
 */
export async function ai_analyze_finances(question) {
    const response = await api.post('/ai/analyze', { question })
    return response.data.data
}

/*
 * FUNCTION : get_ai_usage
 * ─────────────────────────────────────────────────────────
 * WHY      : The usage counter in AiAssistantPage header needs
 *            today's non-cached request count and remaining quota.
 *            Cache hits are free and must NOT appear in "used" —
 *            showing them as consumed would mislead users into
 *            thinking they're burning quota when they're not.
 *
 * HOW      : 1. GET /ai/usage
 *            2. Return the usage summary object
 *
 * @returns {{ non_cached_today, cached_today, daily_limit, remaining }}
 * ─────────────────────────────────────────────────────────
 */
export async function get_ai_usage() {
    const response = await api.get('/ai/usage')
    return response.data.data
}