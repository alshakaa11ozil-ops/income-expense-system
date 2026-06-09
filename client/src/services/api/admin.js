/*
 * ============================================================
 * FILE    : admin.js
 * LAYER   : Service (HTTP)
 * PURPOSE : All admin-only API calls. Prefixed with admin_ to
 *           make ADMIN-role requirement obvious at the call site.
 *           Every function here calls an endpoint guarded by
 *           require_role(['ADMIN']) middleware at the route level.
 * DEPENDS : api/client.js (Axios instance)
 * ============================================================
 * EXPORTS:
 *   admin_get_users, admin_get_user, admin_toggle_user,
 *   admin_promote_user, admin_add_note,
 *   admin_get_audit_records, admin_restore_record,
 *   admin_hard_delete_record, admin_get_dashboard,
 *   admin_get_ai_usage,
 *   admin_get_categories, admin_create_category,
 *   admin_update_category, admin_deactivate_category
 * ============================================================
 */

import api from './client'

// ── User Management ──────────────────────────────────────────

/*
 * FUNCTION : admin_get_users
 * ─────────────────────────────────────────────────────────
 * WHY      : Paginated list of all users for the Users tab.
 *            Admin needs to see all accounts regardless of
 *            their own user_id scope.
 * HOW      : GET /admin/users with page and limit params.
 *            Returns full pagination envelope.
 * @param   {number} page  - Page number (default 1)
 * @param   {number} limit - Records per page (default 20)
 * @returns {{ data: User[], pagination: object }}
 */
export async function admin_get_users(page = 1, limit = 20) {
    const response = await api.get('/admin/users', { params: { page, limit } })
    return response.data   // { data, pagination }
}

/*
 * FUNCTION : admin_get_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Single user detail view including record count
 *            and AI usage stats. Used for future detail modal.
 * @param   {string} user_id
 * @returns {User}
 */
export async function admin_get_user(user_id) {
    const response = await api.get(`/admin/users/${user_id}`)
    return response.data.data
}

/*
 * FUNCTION : admin_toggle_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Flips is_active on a user account. Deactivated
 *            users cannot log in or refresh tokens — the
 *            check_user_is_active middleware rejects them.
 * @param   {string} user_id
 * @returns {User} updated user
 */
export async function admin_toggle_user(user_id) {
    const response = await api.patch(`/admin/users/${user_id}/toggle`)
    return response.data.data
}

/*
 * FUNCTION : admin_promote_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Changes role to ADMIN or USER. Backend rejects
 *            self-promotion with a 400 — but the UI also
 *            disables the button to prevent the wasted call.
 * @param   {string}         user_id
 * @param   {'ADMIN'|'USER'} role
 * @returns {User} updated user
 */
export async function admin_promote_user(user_id, role) {
    const response = await api.patch(`/admin/users/${user_id}/role`, { role })
    return response.data.data
}

/*
 * FUNCTION : admin_add_note
 * ─────────────────────────────────────────────────────────
 * WHY      : Attaches an internal admin note to a user account.
 *            Notes are only visible in the admin panel —
 *            never exposed to the user themselves.
 * @param   {string} user_id
 * @param   {string} note
 * @returns {User} updated user
 */
export async function admin_add_note(user_id, note) {
    const response = await api.patch(`/admin/users/${user_id}/note`, { note })
    return response.data.data
}

// ── Audit Records ─────────────────────────────────────────────

/*
 * FUNCTION : admin_get_audit_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Fetches ALL records for a user including soft-deleted.
 *            Bypasses the normal deleted_at IS NULL filter so
 *            admin can see the full audit trail of history.
 * @param   {string} user_id
 * @param   {number} page
 * @param   {number} limit
 * @returns {{ data: Record[], pagination: object }}
 */
export async function admin_get_audit_records(user_id, page = 1, limit = 20) {
    const response = await api.get(`/admin/records/${user_id}`, {
        params: { page, limit },
    })
    return response.data   // { data, pagination }
}

/*
 * FUNCTION : admin_restore_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Restores a soft-deleted record (sets deleted_at = null).
 *            Route is /records/:id/restore — NOT /admin/records/.
 *            Protected at the route level by admin_guard middleware.
 *            Safe operation — no data is lost.
 * @param   {string} record_id
 * @returns {Record} restored record
 */
export async function admin_restore_record(record_id) {
    const response = await api.post(`/records/${record_id}/restore`)
    return response.data.data
}

/*
 * FUNCTION : admin_hard_delete_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Permanently removes a record from the database.
 *            Irreversible. Route is /records/:id/hard — NOT /admin/.
 *            Protected by admin_guard at the route level.
 *            Only callable after the UI receives typed "DELETE" confirmation.
 * @param   {string} record_id
 * @returns {object} confirmation
 */
export async function admin_hard_delete_record(record_id) {
    const response = await api.delete(`/records/${record_id}/hard`)
    return response.data.data
}

// ── Admin Dashboard ───────────────────────────────────────────

/*
 * FUNCTION : admin_get_dashboard
 * ─────────────────────────────────────────────────────────
 * WHY      : Platform health metrics for the Analytics tab.
 *            Returns only aggregate counts — no user PII exposed.
 *            Single call gives an operational overview of the platform.
 * @returns {{ total_users, active_users, new_users_today,
 *             total_active_records, records_today, deleted_today,
 *             ai_requests_today, cache_hits_today, cache_hit_ratio }}
 */
export async function admin_get_dashboard() {
    const response = await api.get('/admin/dashboard')
    return response.data.data
}

// ── AI Usage Audit ────────────────────────────────────────────

/*
 * FUNCTION : admin_get_ai_usage
 * ─────────────────────────────────────────────────────────
 * WHY      : AI usage log across ALL users.
 *            Route is /ai/usage/all — NOT /admin/ai/usage.
 *            Protected by require_role(['ADMIN']) at the route level.
 *            Shows caching efficiency and per-feature usage patterns.
 * @param   {number} days_back - How many days of history to return
 * @returns {AiUsage[]}
 */
export async function admin_get_ai_usage(days_back = 7) {
    const response = await api.get('/ai/usage/all', { params: { days_back } })
    return response.data.data
}

// ── System Categories ─────────────────────────────────────────

/*
 * FUNCTION : admin_get_categories
 * ─────────────────────────────────────────────────────────
 * WHY      : All SYSTEM categories (user_id IS NULL) including inactive.
 *            Backend already filters WHERE user_id IS NULL — personal
 *            user categories are never returned by this endpoint.
 *            Includes _count.records for deactivation guard UI.
 * @returns {Category[]}
 */
export async function admin_get_categories() {
    const response = await api.get('/admin/categories')
    return response.data.data
}

/*
 * FUNCTION : admin_create_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin creates a new system category visible to all users.
 *            System categories have user_id = null at the DB level,
 *            distinguishing them from user-owned personal categories.
 * @param   {string} name
 * @param   {string} icon  - Emoji character
 * @param   {string} color - Hex color string e.g. "#6B7280"
 * @returns {Category}
 */
export async function admin_create_category(name, icon, color) {
    const response = await api.post('/admin/categories', { name, icon, color })
    return response.data.data
}

/*
 * FUNCTION : admin_update_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin edits a system category. Also handles re-activation
 *            by passing { is_active: true }. The backend model passes
 *            the data object directly to Prisma which accepts all valid
 *            Category fields — is_active is a valid field on Category.
 * @param   {string} category_id
 * @param   {{ name?: string, icon?: string, color?: string, is_active?: boolean }} data
 * @returns {Category}
 */
export async function admin_update_category(category_id, data) {
    const response = await api.put(`/admin/categories/${category_id}`, data)
    return response.data.data
}

/*
 * FUNCTION : admin_deactivate_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Hides a system category from the record form dropdown.
 *            Uses soft-deactivation (is_active = false) — not hard
 *            delete — so existing records keep their category FK intact.
 *            Deactivated categories remain visible in the admin table.
 * @param   {string} category_id
 * @returns {Category}
 */
export async function admin_deactivate_category(category_id) {
    const response = await api.delete(`/admin/categories/${category_id}`)
    return response.data.data
}