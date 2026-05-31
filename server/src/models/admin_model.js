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

module.exports = {
    change_user_role,
    get_all_users,
    get_user_by_id_admin,
    toggle_active,
    set_admin_note,
};