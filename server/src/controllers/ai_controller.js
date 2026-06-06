/*
 * ============================================================
 * FILE    : ai_controller.js
 * LAYER   : Controller
 * PURPOSE : Route handlers for all AI endpoints. Parses req,
 *           validates inputs, calls exactly one service function,
 *           sends response.
 *           No business logic, no Prisma here.
 * DEPENDS : services/ai_service, models/ai_usage_model
 * ============================================================
 * EXPORTS:
 *   - plan         : POST /api/ai/plan       — budget allocation
 *   - advise       : POST /api/ai/advise     — purchase affordability
 *   - analyze      : POST /api/ai/analyze    — free-form finance chat
 *   - get_usage    : GET  /api/ai/usage      — today's usage for req user
 *   - get_all_usage: GET  /api/ai/usage/all  — admin: all users' usage
 * ============================================================
 */

const ai_service   = require('../services/ai_service');
const ai_usage_model = require('../models/ai_usage_model');

// ── Tiny inline validation helpers ───────────────────────────────────────────
// WHY: Rejecting bad inputs at the controller layer means the service and
//      Gemini are never called with blank or garbage data. Keeps error messages
//      user-friendly (400 not 500) and prevents wasted API quota.

function missing_fields(body, required_fields) {
    return required_fields.filter(
        (f) => body[f] === undefined || body[f] === null || body[f] === ''
    );
}

function send_400(res, message) {
    return res.status(400).json({ success: false, error: message });
}

/*
 * FUNCTION : plan
 * ─────────────────────────────────────────────────────────
 * WHY      : Entry point for the Budget Planner tab. Delegates all
 *            logic (caching, limit checks, Gemini call) to ai_service.
 *
 * HOW      : 1. Validate required body fields before calling service
 *            2. Pass user identity and request body to plan_expenses
 *            3. Return the validated category allocation array
 *            4. is_cache_hit tells the UI whether to show "⚡ Instant"
 *
 * @param   {Request}   req  - body: { target_budget, month, year }
 * @param   {Response}  res
 * @param   {Function}  next - forwards unexpected errors to error_handler
 * ─────────────────────────────────────────────────────────
 */
async function plan(req, res, next) {
    try {
        const missing = missing_fields(req.body, ['target_budget', 'month', 'year']);
        if (missing.length > 0) {
            return send_400(res, `Missing required fields: ${missing.join(', ')}`);
        }

        const { data, is_cache_hit } = await ai_service.plan_expenses(
            req.user.id,
            req.user.ai_daily_limit,
            req.body
        );
        return res.status(200).json({ success: true, data, is_cache_hit });
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : advise
 * ─────────────────────────────────────────────────────────
 * WHY      : Entry point for the Purchase Advisor tab. Delegates all
 *            logic to ai_service.advise_purchase.
 *
 * HOW      : 1. Validate required body fields
 *            2. Pass user identity and item details to advise_purchase
 *            3. Return the verdict object { verdict, reasoning, ... }
 *
 * @param   {Request}   req  - body: { item_name, item_cost, planned_date }
 * @param   {Response}  res
 * @param   {Function}  next
 * ─────────────────────────────────────────────────────────
 */
async function advise(req, res, next) {
    try {
        const missing = missing_fields(req.body, ['item_name', 'item_cost']);
        if (missing.length > 0) {
            return send_400(res, `Missing required fields: ${missing.join(', ')}`);
        }

        const { data, is_cache_hit } = await ai_service.advise_purchase(
            req.user.id,
            req.user.ai_daily_limit,
            req.body
        );
        return res.status(200).json({ success: true, data, is_cache_hit });
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : analyze
 * ─────────────────────────────────────────────────────────
 * WHY      : Entry point for the Finance Chat tab. Delegates all
 *            logic to ai_service.analyze_finances.
 *
 * HOW      : 1. Validate question is present and not empty
 *            2. Pass to analyze_finances — deep sanitisation happens in service
 *            3. Return { answer, key_insights[] }
 *
 * @param   {Request}   req  - body: { question: string }
 * @param   {Response}  res
 * @param   {Function}  next
 * ─────────────────────────────────────────────────────────
 */
async function analyze(req, res, next) {
    try {
        if (!req.body.question || typeof req.body.question !== 'string') {
            return send_400(res, 'question is required and must be a string');
        }

        const { data, is_cache_hit } = await ai_service.analyze_finances(
            req.user.id,
            req.user.ai_daily_limit,
            req.body.question
        );
        return res.status(200).json({ success: true, data, is_cache_hit });
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : get_usage
 * ─────────────────────────────────────────────────────────
 * WHY      : Shown in the AiAssistantPage header so users can see
 *            their remaining requests before hitting the daily limit.
 *
 * HOW      : 1. Call get_user_ai_usage with user_id and daily_limit
 *            2. Return { non_cached_today, cached_today, daily_limit, remaining }
 *
 * @param   {Request}   req
 * @param   {Response}  res
 * @param   {Function}  next
 * ─────────────────────────────────────────────────────────
 */
async function get_usage(req, res, next) {
    try {
        const result = await ai_service.get_user_ai_usage(
            req.user.id,
            req.user.ai_daily_limit
        );
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : get_all_usage
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin-only report showing AI usage across all users.
 *            Allows admins to monitor quota consumption and cache
 *            efficiency without querying the DB directly.
 *
 * HOW      : 1. Read days_back from query string (default: 7, max: 90)
 *            2. Call ai_usage_model directly — no service abstraction
 *               needed for this simple admin read
 *            3. Return usage rows with nested user details
 *
 * @param   {Request}   req  - query: { days_back?: number }
 * @param   {Response}  res
 * @param   {Function}  next
 * ─────────────────────────────────────────────────────────
 */
async function get_all_usage(req, res, next) {
    try {
        // Cap days_back at 90 — prevents accidental massive DB queries
        const days_back = Math.min(Number(req.query.days_back) || 7, 90);
        const result = await ai_usage_model.get_all_usage_stats(days_back);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    plan,
    advise,
    analyze,
    get_usage,
    get_all_usage,
};