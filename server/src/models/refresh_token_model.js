/*
 * ============================================================
 * FILE    : refresh_token_model.js
 * LAYER   : Model
 * PURPOSE : All Prisma queries for the RefreshToken table
 * DEPENDS : @prisma/client, src/config/database.js
 * ============================================================
 * EXPORTS:
 *   - create_token       : insert a new hashed refresh token row
 *   - find_valid_token   : find active (non-revoked, non-expired) token for user
 *   - revoke_token       : mark a token as revoked by setting revoked_at
 *   - delete_expired     : remove all expired tokens (cleanup utility)
 * ============================================================
 */

const prisma = require('../config/database');

/*
 * FUNCTION : create_token
 * ─────────────────────────────────────────────────────────
 * WHY      : Persists a new hashed refresh token so we can
 *            verify and revoke it during refresh/logout flows.
 *
 * HOW      : 1. Accept all token metadata as parameters
 *            2. Insert a new row into RefreshToken via Prisma
 *            3. Return the created record (id needed for revocation)
 *
 * @param   {string}   user_id      - The owning user's ID
 * @param   {string}   hashed_token - bcrypt hash of the raw JWT
 * @param   {Date}     expires_at   - When this token expires
 * @param   {string}   user_agent   - Browser/client identifier
 * @param   {string}   ip_address   - Request origin IP
 * @returns {object}                - Created RefreshToken record
 * @throws  {Error}                 - On Prisma write failure
 * ─────────────────────────────────────────────────────────
 */
async function create_token(user_id, hashed_token, expires_at, user_agent, ip_address) {
    return prisma.refreshToken.create({
        data: {
            token: hashed_token,
            user_id,
            expires_at,
            user_agent,
            ip_address,
        },
    });
}

/*
 * FUNCTION : find_valid_token
 * ─────────────────────────────────────────────────────────
 * WHY      : During token refresh, we need to confirm a
 *            valid (not revoked, not expired) token exists
 *            for this user to prevent token reuse attacks.
 *
 * HOW      : 1. Query RefreshToken where user_id matches
 *            2. Filter out revoked rows (revoked_at IS NULL)
 *            3. Filter out expired rows (expires_at > now)
 *            4. Return all matching rows (service picks the right one)
 *
 * @param   {string}   user_id  - The user whose tokens to search
 * @returns {object[]}          - Array of valid RefreshToken records
 * @throws  {Error}             - On Prisma read failure
 * ─────────────────────────────────────────────────────────
 */
async function find_valid_token(user_id) {
    return prisma.refreshToken.findMany({
        where: {
            user_id,
            revoked_at: null,
            expires_at: { gt: new Date() },
        },
    });
}

/*
 * FUNCTION : revoke_token
 * ─────────────────────────────────────────────────────────
 * WHY      : On logout (or suspicious activity), we invalidate
 *            the specific refresh token so it cannot be reused,
 *            without deleting the audit trail.
 *
 * HOW      : 1. Find the RefreshToken row by primary key
 *            2. Set revoked_at = current timestamp
 *            3. Return updated record for confirmation
 *
 * @param   {string}   token_id  - Primary key of the RefreshToken row
 * @returns {object}             - Updated RefreshToken record
 * @throws  {Error}              - If token_id does not exist
 * ─────────────────────────────────────────────────────────
 */
async function revoke_token(token_id) {
    return prisma.refreshToken.update({
        where: { id: token_id },
        data: { revoked_at: new Date() },
    });
}

/*
 * FUNCTION : delete_expired
 * ─────────────────────────────────────────────────────────
 * WHY      : Stale expired tokens accumulate in the DB over
 *            time; this cleanup keeps the table lean and
 *            prevents slow queries on large token sets.
 *
 * HOW      : 1. Delete all rows where expires_at is in the past
 *            2. Return the count of deleted records for logging
 *
 * @returns {object}  - Prisma batch result ({ count: number })
 * @throws  {Error}   - On Prisma write failure
 * ─────────────────────────────────────────────────────────
 */
async function delete_expired() {
    return prisma.refreshToken.deleteMany({
        where: {
            expires_at: { lt: new Date() },
        },
    });
}

module.exports = {
    create_token,
    find_valid_token,
    revoke_token,
    delete_expired,
};