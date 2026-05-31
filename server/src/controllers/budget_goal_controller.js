/*
 * ============================================================
 * FILE    : budget_goal_controller.js
 * LAYER   : Controller
 * PURPOSE : Parse requests and dispatch to budget_goal_service
 * DEPENDS : src/services/budget_goal_service.js,
 *           src/utils/api_response.js
 * ============================================================
 * EXPORTS:
 *   - get_goals        : GET enriched goals for a month
 *   - get_write_window : GET what months are currently writable
 *   - save_goals       : PUT save/replace goals for a month
 *   - delete_goal      : DELETE one goal (write window enforced)
 * ============================================================
 */

const budget_goal_service = require('../services/budget_goal_service');
const { send_success, send_error } = require('../utils/api_response');

/*
 * FUNCTION : get_goals
 * ─────────────────────────────────────────────────────────
 * WHY      : Returns enriched goals for a month. Past months
 *            include is_expired=true so UI renders them as history.
 * HOW      : Parse month/year from query, call service, return 200.
 * @returns {200} enriched goal array with is_expired flag
 * ─────────────────────────────────────────────────────────
 */
async function get_goals(req, res) {
    try {
        const goals = await budget_goal_service.get_monthly_goals(
            req.user.user_id,
            Number(req.query.month),
            Number(req.query.year)
        );
        return send_success(res, goals);
    } catch (err) {
        return send_error(res, err.message, 400);
    }
}

/*
 * FUNCTION : get_write_window
 * ─────────────────────────────────────────────────────────
 * WHY      : Frontend needs to know which months it can show edit
 *            controls for. Rather than recomputing client-side,
 *            the server exposes the authoritative window.
 * HOW      : Call service helper, return 200.
 * @returns {200} { min_month, min_year, max_month, max_year }
 * ─────────────────────────────────────────────────────────
 */
async function get_write_window_handler(req, res) {
    try {
        return send_success(res, budget_goal_service.get_write_window());
    } catch (err) {
        return send_error(res, err.message, 500);
    }
}

/*
 * FUNCTION : save_goals
 * ─────────────────────────────────────────────────────────
 * WHY      : Persists AI-suggested (or user-edited) goals for a month.
 *            Write window enforced in service.
 * HOW      : Pass user_id + body to service, return 201.
 * @returns {201} enriched goal array for the saved month
 * ─────────────────────────────────────────────────────────
 */
async function save_goals(req, res) {
    try {
        const goals = await budget_goal_service.save_goals_for_month(
            req.user.user_id,
            req.body.goals,
            req.body.month,
            req.body.year,
            req.body.replace ?? false
        );
        return send_success(res, goals, 201);
    } catch (err) {
        return send_error(res, err.message, 400);
    }
}

/*
 * FUNCTION : delete_goal
 * ─────────────────────────────────────────────────────────
 * WHY      : User removes one category from their budget plan.
 *            month + year passed so service can enforce write window.
 * HOW      : Pass user_id + goal id + month/year to service.
 * @returns {200} deleted goal
 * ─────────────────────────────────────────────────────────
 */
async function delete_goal(req, res) {
    try {
        const goal = await budget_goal_service.remove_goal(
            req.user.user_id,
            req.params.id,
            req.query.month,
            req.query.year
        );
        return send_success(res, goal);
    } catch (err) {
        const status = err.message === 'Budget goal not found' ? 404 : 400;
        return send_error(res, err.message, status);
    }
}

module.exports = { get_goals, get_write_window: get_write_window_handler, save_goals, delete_goal };