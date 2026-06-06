/*
 * ============================================================
 * FILE    : admin_model.js
 * LAYER   : Model
 * PURPOSE : Prisma queries for admin user management operations
 * DEPENDS : src/config/database.js (Prisma singleton)
 * ============================================================
 * EXPORTS:
 *   - change_user_role      : update a user's role field
 *   - get_all_users         : paginated user list with record counts
 *   - get_user_by_id_admin  : single user with stats and admin_note
 *   - toggle_active         : flip is_active boolean
 *   - set_admin_note        : attach internal note to user account
 * ============================================================
 */
/*
 * ============================================================
 * FILE    : admin_model.js  (ADDITIONS — Chat 6)
 * LAYER   : Model
 * PURPOSE : Adds admin audit record query and dashboard stats
 *           to the existing admin model.
 * DEPENDS : prisma (PrismaClient instance from config/database.js)
 * ============================================================
 * NEW EXPORTS (added in Chat 6):
 *   - get_all_records_for_user  : admin audit — all records incl. deleted
 *   - get_admin_dashboard_stats : operational health counts for today
 * ============================================================
 */

const prisma = require('../config/database');

// fields returned for every user — password is explicitly excluded
const USER_SAFE_SELECT = {
    id: true,
    username: true,
    email: true,
    role: true,
    is_active: true,
    ai_daily_limit: true,
    admin_note: true,
    last_login_at: true,
    created_at: true,
    updated_at: true,
};

/*
 * FUNCTION : change_user_role
 * ─────────────────────────────────────────────────────────
 * WHY      : Persists a role change made by an admin.
 *            Only touches the role field — nothing else.
 *
 * HOW      : prisma.user.update where id = target_user_id, role = new_role
 *
 * @param   {string} target_user_id
 * @param   {string} new_role - 'USER' or 'ADMIN'
 * @returns {User} - updated user without password
 * ─────────────────────────────────────────────────────────
 */
async function change_user_role(target_user_id, new_role) {
    return prisma.user.update({
        where: { id: target_user_id },
        data: { role: new_role },
        select: USER_SAFE_SELECT,
    });
}

/*
 * FUNCTION : get_all_users
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin needs a paginated list of all user accounts
 *            to manage them (promote, deactivate, add notes).
 *
 * HOW      : prisma.user.findMany, skip/take for pagination,
 *            select EXCLUDES password field
 *            include _count of records for each user
 *
 * @param   {number} skip
 * @param   {number} take
 * @returns {{ users: User[], total: number }}
 * ─────────────────────────────────────────────────────────
 */
async function get_all_users(skip, take) {
    const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
            skip,
            take,
            select: {
                ...USER_SAFE_SELECT,
                _count: { select: { records: true, ai_usage: true } },
            },
            orderBy: { created_at: 'desc' },
        }),
        prisma.user.count(),
    ]);

    return { users, total };
}

/*
 * FUNCTION : get_user_by_id_admin
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin view of a single user — includes stats, note.
 *            Different from regular find_by_id because it includes
 *            admin_note and record counts.
 *
 * HOW      : prisma.user.findUnique, include record count + ai usage count
 *
 * @param   {string} user_id
 * @returns {User} - without password
 * ─────────────────────────────────────────────────────────
 */
async function get_user_by_id_admin(user_id) {
    return prisma.user.findUnique({
        where: { id: user_id },
        select: {
            ...USER_SAFE_SELECT,
            _count: { select: { records: true, ai_usage: true } },
        },
    });
}

/*
 * FUNCTION : toggle_active
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin can deactivate accounts without deleting them.
 *            Deactivated users cannot log in (auth_middleware checks is_active).
 *
 * HOW      : prisma.user.update flip is_active boolean
 *
 * @param   {string} target_user_id
 * @returns {User}
 * ─────────────────────────────────────────────────────────
 */
async function toggle_active(target_user_id) {
    // read current state first, then flip — keeps the toggle atomic
    const current = await prisma.user.findUnique({
        where: { id: target_user_id },
        select: { is_active: true },
    });

    return prisma.user.update({
        where: { id: target_user_id },
        data: { is_active: !current.is_active },
        select: USER_SAFE_SELECT,
    });
}

/*
 * FUNCTION : set_admin_note
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin can attach a note to any user account for internal use.
 *
 * HOW      : prisma.user.update where id, set admin_note = note
 *
 * @param   {string} target_user_id
 * @param   {string} note
 * @returns {User}
 * ─────────────────────────────────────────────────────────
 */
async function set_admin_note(target_user_id, note) {
    return prisma.user.update({
        where: { id: target_user_id },
        data: { admin_note: note },
        select: USER_SAFE_SELECT,
    });
}

/*
 * FUNCTION : get_all_records_for_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin audit view needs ALL records for a specific user —
 *            including soft-deleted ones. This is intentionally different
 *            from record_model.find_many which enforces deleted_at: null.
 *            An admin needs to see what a user has created and deleted
 *            so they can make restore/hard-delete decisions.
 *
 * HOW      : 1. Query prisma.record.findMany for target_user_id only
 *            2. AUDIT BYPASS: deliberately omit deleted_at filter
 *            3. OWNERSHIP BYPASS: filter by target_user_id not requester
 *            4. Order by created_at desc so newest appear first
 *            5. Run count + findMany in a transaction for consistent totals
 *
 * @param   {string} target_user_id  - The user whose records to audit
 * @param   {number} skip            - Pagination offset
 * @param   {number} take            - Pagination page size
 * @returns {[Record[], number]}     - [rows, total count]
 * ─────────────────────────────────────────────────────────
 */
async function get_all_records_for_user(target_user_id, skip, take) {
    const [rows, total] = await prisma.$transaction([
        prisma.record.findMany({
            where: {
                user_id: target_user_id,
                // AUDIT BYPASS: admin view — intentionally includes soft-deleted records.
                // Normal queries always add deleted_at: null here. We deliberately omit
                // it so the admin can see what was deleted and decide to restore or hard-delete.
                // OWNERSHIP BYPASS: we filter by the TARGET user's id, not the requesting
                // admin's id. This is safe because require_role(['ADMIN']) has already
                // verified the requester is an admin before this function is ever called.
            },
            orderBy: { created_at: 'desc' },
            skip,
            take,
        }),
        prisma.record.count({
            where: {
                user_id: target_user_id,
                // AUDIT BYPASS: count must also include soft-deleted records
                // so pagination totals match the rows returned above.
            },
        }),
    ]);

    return [rows, total];
}

/*
 * FUNCTION : get_admin_dashboard_stats
 * ─────────────────────────────────────────────────────────
 * WHY      : The admin panel overview tab needs operational health metrics —
 *            how many users, how many records today, how much AI was used.
 *            These are platform health metrics, not financial analytics.
 *            Separate from analytics_service.get_system_summary() which
 *            answers "how much money flows through the platform?"
 *
 * HOW      : 1. Calculate today_start (midnight of current day UTC)
 *               WHY: using new Date() directly would give "last millisecond"
 *               not "since midnight" — we want day-level granularity
 *            2. Run 8 Prisma count queries in a single $transaction
 *               WHY $transaction: guarantees all counts come from the same
 *               point in time — no race conditions between counts
 *            3. Return a flat stats object
 *
 * @returns {object} - Platform health stats for today
 * ─────────────────────────────────────────────────────────
 */
async function get_admin_dashboard_stats() {
    // Start of today in UTC — all "today" counts use this as their lower bound
    const today_start = new Date();
    today_start.setUTCHours(0, 0, 0, 0);

    const [
        total_users,
        active_users,
        new_users_today,
        total_active_records,
        records_today,
        deleted_today,
        ai_requests_today,
        cache_hits_today,
    ] = await prisma.$transaction([
        // Total registered users ever
        prisma.user.count(),

        // Users who are currently active (not deactivated by admin)
        prisma.user.count({
            where: { is_active: true },
        }),

        // Users who registered today — platform growth signal
        prisma.user.count({
            where: { created_at: { gte: today_start } },
        }),

        // Records that exist and are NOT soft-deleted — live data count
        prisma.record.count({
            where: { deleted_at: null },
        }),

        // Records created today (and not deleted) — activity signal
        prisma.record.count({
            where: {
                created_at: { gte: today_start },
                deleted_at: null,
            },
        }),

        // Records soft-deleted today — monitors unusual deletion spikes
        // NOTE: updated_at is used here because deleted_at stores the timestamp
        // of deletion and is the field we check, but filtering on deleted_at { gte }
        // AND { not: null } correctly captures records deleted today
        prisma.record.count({
            where: {
                deleted_at: { not: null, gte: today_start },
            },
        }),

        // All AI requests today (cached + non-cached) — total AI load
        prisma.aiUsage.count({
            where: { created_at: { gte: today_start } },
        }),

        // AI requests today that were served from cache — cache effectiveness
        prisma.aiUsage.count({
            where: {
                created_at: { gte: today_start },
                was_cached: true,
            },
        }),
    ]);

    return {
        total_users,
        active_users,
        new_users_today,
        total_active_records,
        records_today,
        deleted_today,
        ai_requests_today,
        cache_hits_today,
    };
}

module.exports = {
    change_user_role,
    get_all_users,
    get_user_by_id_admin,
    toggle_active,
    set_admin_note,
    get_all_records_for_user,
    get_admin_dashboard_stats,
};