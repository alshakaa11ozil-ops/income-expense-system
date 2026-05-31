/*
 * ============================================================
 * FILE    : user_model.js
 * LAYER   : Model
 * PURPOSE : All Prisma queries for the User table
 * DEPENDS : @prisma/client, src/config/database.js
 * ============================================================
 * EXPORTS:
 *   - create_user         : insert a new user row (no password returned)
 *   - find_by_email       : fetch user including password (auth use only)
 *   - find_by_id          : fetch user by primary key (no password returned)
 *   - update_last_login   : stamp last_login_at on successful auth
 * ============================================================
 */

const prisma = require('../config/database');

/*
 * Shared select object — never expose the password field in
 * regular responses. find_by_email is the ONLY function that
 * must bypass this and include the password for bcrypt comparison.
 */
const SAFE_USER_SELECT = {
    id: true,
    username: true,
    email: true,
    role: true,
    is_active: true,
    ai_daily_limit: true,
    last_login_at: true,
    created_at: true,
    updated_at: true,
};

/*
 * FUNCTION : create_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Encapsulates user creation so the service layer
 *            never needs to know about the Prisma API or which
 *            fields have defaults (role, is_active, etc.).
 *
 * HOW      : 1. Insert user_data into the User table
 *            2. Use explicit select to guarantee password is
 *               never present in the returned object
 *            3. Return the created user record
 *
 * @param   {object}   user_data  - { username, email, password (hashed),
 *                                    role?, ai_daily_limit? }
 * @returns {object}              - Created user (no password field)
 * @throws  {Error}               - On unique constraint violation or DB error
 * ─────────────────────────────────────────────────────────
 */
async function create_user(user_data) {
    return prisma.user.create({
        data: user_data,
        select: SAFE_USER_SELECT,
    });
}

/*
 * FUNCTION : find_by_email
 * ─────────────────────────────────────────────────────────
 * WHY      : Login requires the hashed password to perform
 *            bcrypt.compare — this is the ONLY place in the
 *            codebase that should return the password field.
 *
 * HOW      : 1. Query User by unique email index
 *            2. Return the full record INCLUDING password
 *            3. Caller (auth_service) is responsible for never
 *               forwarding the password field onward
 *
 * @param   {string}   email  - The email address to search for
 * @returns {object|null}     - Full user record with password, or null
 * @throws  {Error}           - On Prisma read failure
 * ─────────────────────────────────────────────────────────
 */
async function find_by_email(email) {
    // password intentionally included — this function is for auth only
    return prisma.user.findUnique({
        where: { email },
    });
}

/*
 * FUNCTION : find_by_id
 * ─────────────────────────────────────────────────────────
 * WHY      : Used after token verification to hydrate req.user
 *            with the current user's details for downstream use.
 *
 * HOW      : 1. Query User by primary key (cuid)
 *            2. Use SAFE_USER_SELECT to strip the password field
 *            3. Return the user or null if not found
 *
 * @param   {string}   user_id  - The user's primary key (cuid string)
 * @returns {object|null}       - User record without password, or null
 * @throws  {Error}             - On Prisma read failure
 * ─────────────────────────────────────────────────────────
 */
async function find_by_id(user_id) {
    return prisma.user.findUnique({
        where: { id: user_id },
        select: SAFE_USER_SELECT,
    });
}

/*
 * FUNCTION : update_last_login
 * ─────────────────────────────────────────────────────────
 * WHY      : Tracking last_login_at helps admins audit
 *            inactive accounts and detect anomalous access
 *            patterns without storing full session logs.
 *
 * HOW      : 1. Update the User row matching user_id
 *            2. Set last_login_at to the current timestamp
 *            3. Return minimal confirmation (id only — no select overhead)
 *
 * @param   {string}   user_id  - Primary key of the user to update
 * @returns {object}            - Updated user ({ id })
 * @throws  {Error}             - If user_id does not exist
 * ─────────────────────────────────────────────────────────
 */
async function update_last_login(user_id) {
    return prisma.user.update({
        where: { id: user_id },
        data: { last_login_at: new Date() },
        select: { id: true },
    });
}

module.exports = {
    create_user,
    find_by_email,
    find_by_id,
    update_last_login,
};