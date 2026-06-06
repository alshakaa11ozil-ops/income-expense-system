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
const Decimal = require('decimal.js');

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

/*
 * FUNCTION : get_audit_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin reviews ALL records belonging to a specific user,
 *            including soft-deleted ones, for audit and restore purposes.
 *            Read-only — the admin sees the data but cannot edit records
 *            that belong to another user (data integrity principle).
 *
 * HOW      : 1. Verify the target user exists first via admin_model
 *               WHY: without this, a non-existent user_id returns an
 *               empty array which is indistinguishable from "user has
 *               no records" — a 404 is clearer and more honest
 *            2. Parse pagination from query_params (page, limit)
 *            3. Call admin_model.get_all_records_for_user — this query
 *               deliberately skips deleted_at and ownership filters
 *            4. Serialize each record's Decimal amount to "1500.00" string
 *               WHY: Decimal objects cannot be JSON.stringify'd directly
 *            5. Return paginated response shape
 *
 * @param   {string} target_user_id  - ID of the user whose records to audit
 * @param   {object} query_params    - { page, limit } from req.query
 * @returns {{ data: Record[], pagination: object }}
 * @throws  {Error} with status 404 if target user does not exist
 * ─────────────────────────────────────────────────────────
 */
async function get_audit_records(target_user_id, query_params) {
    // Verify target user exists before querying their records.
    // A missing user returns null — throw 404 to distinguish from "user has no records"
    const target_user = await admin_model.get_user_by_id_admin(target_user_id);
    if (!target_user) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    const { skip, take, page, limit } = get_pagination_params(query_params, 20);
    // WHY default 20 (not 10): admin audit tables are wider and show more
    // columns — more rows per page means fewer clicks to review all records

    const [rows, total] = await admin_model.get_all_records_for_user(
        target_user_id,
        skip,
        take
    );

    // Serialize Decimal amounts to strings — Decimal objects break JSON serialization
    // and floating-point math on the frontend is forbidden by the currency rules
    const serialized_records = rows.map((record) => ({
        ...record,
        amount: record.amount.toFixed(2),
    }));

    return format_paginated_response(serialized_records, total, page, limit);
}

/*
 * FUNCTION : get_dashboard_stats
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides the admin panel overview tab with operational platform
 *            health metrics. Answers "how is the platform doing today?"
 *            NOT "how much money is flowing?" (that is analytics_service).
 *
 * HOW      : 1. Call admin_model.get_admin_dashboard_stats() — gets 8 counts
 *               from a single DB transaction
 *            2. Calculate cache_hit_ratio as a percentage string
 *               WHY decimal.js: percentage calculations have the same
 *               IEEE 754 floating-point problem as financial math.
 *               33 / 100 * 100 = 33.00000000000003 in plain JS.
 *               decimal.js gives clean "33.33" every time.
 *            3. Return all stats in a flat object for the frontend
 *
 * @returns {object}
 *   { total_users, active_users, new_users_today,
 *     total_active_records, records_today, deleted_today,
 *     ai_requests_today, cache_hits_today, cache_hit_ratio }
 * ─────────────────────────────────────────────────────────
 */
async function get_dashboard_stats() {
    const stats = await admin_model.get_admin_dashboard_stats();

    // Calculate what percentage of today's AI requests were cache hits
    // Use decimal.js — same precision rules apply as financial math
    let cache_hit_ratio;
    if (stats.ai_requests_today === 0) {
        // Avoid division by zero — ratio is meaningless with no requests
        cache_hit_ratio = '0.00';
    } else {
        cache_hit_ratio = new Decimal(stats.cache_hits_today)
            .dividedBy(stats.ai_requests_today)
            .times(100)
            .toFixed(2);
        // Result is a string like "33.33" — never a raw JS float
    }

    return {
        ...stats,
        cache_hit_ratio,
    };
}

module.exports = {
    promote_user,
    list_users,
    toggle_account,
    add_note,
    get_user_detail,
    get_audit_records,
    get_dashboard_stats,
};