/*
 * ============================================================
 * FILE    : admin_controller.js
 * LAYER   : Controller
 * PURPOSE : Parse requests and dispatch to admin_service
 * DEPENDS : src/services/admin_service.js,
 *           src/utils/api_response.js
 * ============================================================
 * EXPORTS:
 *   - list_users   : GET paginated user list
 *   - get_user     : GET single user detail
 *   - toggle_user  : PATCH activate/deactivate user
 *   - promote_user : PATCH change user role
 *   - add_note     : PATCH set admin note on user
 * ============================================================
 */

const admin_service = require('../services/admin_service');
const { send_success, send_error, send_paginated } = require('../utils/api_response');

/*
 * FUNCTION : list_users
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin panel table of all users with pagination.
 * HOW      : Pass query params to service, return paginated response.
 * @returns {200} paginated user list
 * ─────────────────────────────────────────────────────────
 */
async function list_users(req, res) {
    try {
        const { data, pagination } = await admin_service.list_users(req.query);
        return send_paginated(res, data, pagination);
    } catch (err) {
        return send_error(res, err.message, 500);
    }
}

/*
 * FUNCTION : get_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin views full detail of a single user account.
 * HOW      : Pass id param to service, return 200.
 * @returns {200} user detail object
 * ─────────────────────────────────────────────────────────
 */
async function get_user(req, res) {
    try {
        const user = await admin_service.get_user_detail(req.params.id);
        return send_success(res, user);
    } catch (err) {
        return send_error(res, err.message, 404);
    }
}

/*
 * FUNCTION : toggle_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin activates or deactivates a user account.
 * HOW      : Pass requesting admin id + target id to service.
 * @returns {200} updated user
 * ─────────────────────────────────────────────────────────
 */
async function toggle_user(req, res) {
    try {
        const user = await admin_service.toggle_account(req.user.id, req.params.id);
        return send_success(res, user);
    } catch (err) {
        const status = err.message === 'User not found' ? 404 : 400;
        return send_error(res, err.message, status);
    }
}

/*
 * FUNCTION : promote_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin promotes or demotes another user's role.
 * HOW      : Pass requesting admin id + target id + new role to service.
 * @returns {200} updated user
 * ─────────────────────────────────────────────────────────
 */
async function promote_user(req, res) {
    try {
        const user = await admin_service.promote_user(req.user.id, req.params.id, req.body.role);
        return send_success(res, user);
    } catch (err) {
        const status = err.message === 'User not found' ? 404 : 400;
        return send_error(res, err.message, status);
    }
}

/*
 * FUNCTION : add_note
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin attaches internal note to a user account.
 * HOW      : Pass target id + note body to service.
 * @returns {200} updated user
 * ─────────────────────────────────────────────────────────
 */
async function add_note(req, res) {
    try {
        const user = await admin_service.add_note(req.params.id, req.body.note);
        return send_success(res, user);
    } catch (err) {
        const status = err.message === 'User not found' ? 404 : 400;
        return send_error(res, err.message, status);
    }
}

/*
 * FUNCTION : audit_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin needs to view all records for a specific user including
 *            soft-deleted ones — the normal GET /api/records endpoint only
 *            returns the requesting user's own non-deleted records, which
 *            is the wrong behavior for an admin audit view.
 *
 * HOW      : 1. Extract target user_id from route params (not req.user.id —
 *               this is ANOTHER user's id, not the admin's own id)
 *            2. Pass req.query for pagination (page, limit)
 *            3. Delegate all logic to admin_service.get_audit_records
 *            4. Return paginated response
 *
 * @param   {object} req - req.params.user_id, req.query
 * @param   {object} res
 * @param   {function} next
 * ─────────────────────────────────────────────────────────
 */
async function audit_records(req, res, next) {
    try {
        const result = await admin_service.get_audit_records(
            req.params.user_id,  // NOTE: this is the TARGET user's id, not req.user.id
            req.query
        );
        return send_paginated(res, result.data, result.pagination);
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : dashboard_stats
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin panel overview tab needs operational health metrics for
 *            the platform — user counts, activity today, AI usage, cache
 *            hit ratio. These are NOT financial analytics.
 *
 * HOW      : 1. No params needed — always returns "today's" stats
 *            2. Delegate to admin_service.get_dashboard_stats
 *            3. Return success response
 *
 * @param   {object} req
 * @param   {object} res
 * @param   {function} next
 * ─────────────────────────────────────────────────────────
 */
async function dashboard_stats(req, res, next) {
    try {
        const result = await admin_service.get_dashboard_stats();
        return send_success(res, result);
    } catch (err) {
        next(err);
    }
}
module.exports = { list_users, get_user, toggle_user, promote_user, add_note, audit_records, dashboard_stats, };