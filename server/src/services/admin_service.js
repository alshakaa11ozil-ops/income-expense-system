/*
 * ============================================================
 * FILE    : admin_service.js
 * LAYER   : Service
 * PURPOSE : Business logic for admin user management operations
 * DEPENDS : src/models/admin_model.js
 * ============================================================
 * EXPORTS:
 *   - promote_user    : change a user's role (promote/demote)
 *   - list_users      : paginated user list
 *   - toggle_account  : activate or deactivate a user account
 *   - add_note        : attach admin note to a user
 *   - get_user_detail : single user detail view
 * ============================================================
 */

// ARCHITECTURE GUARD: This file must never import PrismaClient.
// All DB access goes through functions in src/models/admin_model.js only.

const admin_model = require('../models/admin_model');
const { get_pagination_params, format_paginated_response } = require('../utils/pagination');

const VALID_ROLES = ['USER', 'ADMIN'];

/*
 * FUNCTION : promote_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Allows an admin to change another user's role.
 *            The first admin is seeded — all subsequent promotions
 *            go through this function from the Admin Panel.
 *
 * HOW      : 1. Validate new_role is exactly 'USER' or 'ADMIN'
 *            2. CRITICAL SAFETY CHECK: if target_user_id === requesting_admin_id
 *               → throw Error('You cannot change your own role')
 *               WHY: prevents accidental self-demotion + self-lockout
 *            3. Fetch target user via admin_model.get_user_by_id_admin
 *            4. If not found → throw Error('User not found')
 *            5. Call admin_model.change_user_role(target_user_id, new_role)
 *            6. Return updated user (no password)
 *
 * @param   {string} requesting_admin_id - the admin making the change
 * @param   {string} target_user_id      - user being promoted/demoted
 * @param   {string} new_role            - 'USER' or 'ADMIN'
 * @returns {User}
 * @throws  {Error} if self-change, user not found, or invalid role
 * ─────────────────────────────────────────────────────────
 */
async function promote_user(requesting_admin_id, target_user_id, new_role) {
    // validate role value before touching the DB
    if (!VALID_ROLES.includes(new_role)) {
        throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // prevent self-demotion — an admin accidentally locking themselves out is catastrophic
    if (requesting_admin_id === target_user_id) {
        throw new Error('You cannot change your own role');
    }

    const target_user = await admin_model.get_user_by_id_admin(target_user_id);
    if (!target_user) {
        throw new Error('User not found');
    }

    return admin_model.change_user_role(target_user_id, new_role);
}

/*
 * FUNCTION : list_users
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides paginated user list for the Admin Panel.
 *
 * HOW      : 1. Parse page + limit from query params
 *            2. Calculate skip = (page - 1) * limit
 *            3. Call admin_model.get_all_users(skip, limit)
 *            4. Return data + pagination object
 *
 * @param   {object} query_params - { page, limit }
 * @returns {{ users, pagination }}
 * ─────────────────────────────────────────────────────────
 */
async function list_users(query_params) {
    const { skip, take, page, limit } = get_pagination_params(query_params, 20);

    const { users, total } = await admin_model.get_all_users(skip, take);

    return format_paginated_response(users, total, page, limit);
}

/*
 * FUNCTION : toggle_account
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin activates or deactivates a user account.
 *            Deactivated users get 403 on next request (auth_middleware).
 *
 * HOW      : 1. Safety check: cannot deactivate yourself
 *            2. Get user to confirm they exist
 *            3. Call admin_model.toggle_active
 *
 * @param   {string} requesting_admin_id
 * @param   {string} target_user_id
 * @returns {User}
 * @throws  {Error} if self-action or user not found
 * ─────────────────────────────────────────────────────────
 */
async function toggle_account(requesting_admin_id, target_user_id) {
    // prevent admin from deactivating themselves and losing access
    if (requesting_admin_id === target_user_id) {
        throw new Error('You cannot deactivate your own account');
    }

    const target_user = await admin_model.get_user_by_id_admin(target_user_id);
    if (!target_user) {
        throw new Error('User not found');
    }

    return admin_model.toggle_active(target_user_id);
}

/*
 * FUNCTION : add_note
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin attaches an internal note to a user for record-keeping.
 *
 * HOW      : 1. Verify user exists
 *            2. Call admin_model.set_admin_note
 *
 * @param   {string} target_user_id
 * @param   {string} note
 * @returns {User}
 * @throws  {Error} if user not found
 * ─────────────────────────────────────────────────────────
 */
async function add_note(target_user_id, note) {
    const target_user = await admin_model.get_user_by_id_admin(target_user_id);
    if (!target_user) {
        throw new Error('User not found');
    }

    return admin_model.set_admin_note(target_user_id, note ?? '');
}

/*
 * FUNCTION : get_user_detail
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin views a single user's full profile including stats.
 *
 * HOW      : 1. Call admin_model.get_user_by_id_admin
 *            2. Throw if not found
 *
 * @param   {string} target_user_id
 * @returns {User}
 * @throws  {Error} if user not found
 * ─────────────────────────────────────────────────────────
 */
async function get_user_detail(target_user_id) {
    const user = await admin_model.get_user_by_id_admin(target_user_id);
    if (!user) {
        throw new Error('User not found');
    }
    return user;
}

module.exports = {
    promote_user,
    list_users,
    toggle_account,
    add_note,
    get_user_detail,
};