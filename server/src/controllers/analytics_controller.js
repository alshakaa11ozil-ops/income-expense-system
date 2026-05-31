/*
 * ============================================================
 * FILE    : analytics_controller.js
 * LAYER   : Controller
 * PURPOSE : Route handlers for analytics endpoints.
 *           Parses query params, calls one service function, sends response.
 *           Contains zero business logic, zero Prisma, zero math.
 * DEPENDS : src/services/analytics_service.js,
 *           src/utils/api_response.js
 * ============================================================
 * EXPORTS:
 *   - summary        : GET /api/analytics/summary
 *   - trends         : GET /api/analytics/trends
 *   - categories     : GET /api/analytics/categories
 *   - daily_balance  : GET /api/analytics/daily
 *   - system_summary : GET /api/analytics/system (ADMIN ONLY)
 * ============================================================
 */

const analytics_service = require('../services/analytics_service');
const { send_success, send_error } = require('../utils/api_response');

// Default to the current calendar month and year for endpoints that need them.
// These are computed at module load — sufficiently stable for one request lifecycle.
const now = new Date();
const current_month = now.getMonth() + 1;  // getMonth() is 0-indexed; January = 0
const current_year = now.getFullYear();

/*
 * FUNCTION : summary
 * ─────────────────────────────────────────────────────────
 * WHY      : Serves the three dashboard summary cards (total income,
 *            total expense, net balance) for a given month.
 *
 * HOW      : 1. Read optional month/year from query params
 *            2. Default to current month and year if not provided
 *            3. Delegate to analytics_service.get_summary
 *            4. Send success response
 *
 * @param   {Request}  req - query: { month?, year? }
 * @param   {Response} res
 * @param   {Function} next - forwards errors to error_handler middleware
 * ─────────────────────────────────────────────────────────
 */
async function summary(req, res, next) {
    try {
        const month = Number(req.query.month) || current_month;
        const year = Number(req.query.year) || current_year;
        const result = await analytics_service.get_summary(req.user.user_id, month, year);
        send_success(res, result);
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : trends
 * ─────────────────────────────────────────────────────────
 * WHY      : Serves the income vs expense line chart with configurable
 *            lookback window. Dashboard uses 6 months; AI uses 3 months.
 *
 * HOW      : 1. Read optional months_back from query params, default 6
 *            2. Delegate to analytics_service.get_monthly_trends
 *            3. Send success response
 *
 * @param   {Request}  req - query: { months_back? }
 * @param   {Response} res
 * @param   {Function} next
 * ─────────────────────────────────────────────────────────
 */
async function trends(req, res, next) {
    try {
        const months_back = Number(req.query.months_back) || 6;
        const result = await analytics_service.get_monthly_trends(req.user.user_id, months_back);
        send_success(res, result);
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : categories
 * ─────────────────────────────────────────────────────────
 * WHY      : Serves the expense pie chart and budget goal progress data
 *            for a given month.
 *
 * HOW      : 1. Read optional month/year from query params
 *            2. Default to current month and year
 *            3. Delegate to analytics_service.get_category_breakdown
 *            4. Send success response
 *
 * @param   {Request}  req - query: { month?, year? }
 * @param   {Response} res
 * @param   {Function} next
 * ─────────────────────────────────────────────────────────
 */
async function categories(req, res, next) {
    try {
        const month = Number(req.query.month) || current_month;
        const year = Number(req.query.year) || current_year;
        const result = await analytics_service.get_category_breakdown(req.user.user_id, month, year);
        send_success(res, result);
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : daily_balance
 * ─────────────────────────────────────────────────────────
 * WHY      : Serves the running balance chart for a user-defined
 *            date range. Shows balance movement day by day.
 *
 * HOW      : 1. Read date_from and date_to from query params
 *            2. Convert to Date objects (validation happens in service)
 *            3. Delegate to analytics_service.get_daily_balance
 *            4. Send success response
 *
 * @param   {Request}  req - query: { date_from, date_to } ISO date strings
 * @param   {Response} res
 * @param   {Function} next
 * ─────────────────────────────────────────────────────────
 */
async function daily_balance(req, res, next) {
    try {
        const date_from = new Date(req.query.date_from);
        const date_to = new Date(req.query.date_to);
        const result = await analytics_service.get_daily_balance(
            req.user.user_id, date_from, date_to
        );
        send_success(res, result);
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : system_summary
 * ─────────────────────────────────────────────────────────
 * WHY      : Serves admin-level platform health metrics — all users combined.
 *            Guarded by require_role(['ADMIN']) at the route level;
 *            this handler itself has no auth logic.
 *
 * HOW      : 1. No query params needed — no user_id filter for system view
 *            2. Delegate to analytics_service.get_system_summary
 *            3. Send success response
 *
 * @param   {Request}  req
 * @param   {Response} res
 * @param   {Function} next
 * ─────────────────────────────────────────────────────────
 */
async function system_summary(req, res, next) {
    try {
        const result = await analytics_service.get_system_summary();
        send_success(res, result);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    summary,
    trends,
    categories,
    daily_balance,
    system_summary,
};