/*
 * ============================================================
 * FILE    : auth_service.js
 * LAYER   : Service
 * PURPOSE : All authentication business logic: register, login,
 *           refresh, logout, and current-user retrieval
 * DEPENDS : bcrypt, jsonwebtoken, crypto, user_model, refresh_token_model
 * ============================================================
 * EXPORTS:
 *   - register_user        : validate + create a new user account
 *   - login_user           : verify credentials + issue tokens
 *   - refresh_access_token : validate refresh cookie + issue new access token
 *   - logout_user          : revoke the stored refresh token
 *   - get_current_user     : return safe user profile by ID
 * ============================================================
 */

// ARCHITECTURE GUARD: This file must never import PrismaClient.
// All DB access goes through functions in src/models/*.js only.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const user_model = require('../models/user_model');
const refresh_token_model = require('../models/refresh_token_model');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

// ─── Token helpers ────────────────────────────────────────────────────────────

/*
 * FUNCTION : sign_access_token
 * ─────────────────────────────────────────────────────────
 * WHY      : Centralises JWT signing so the algorithm,
 *            expiry, and payload shape are defined once.
 *
 * HOW      : 1. Build payload with user_id, email, role
 *            2. Sign with JWT_ACCESS_SECRET + 15 min expiry
 *            3. Return the signed string
 *
 * @param   {object}   user  - { id, email, role }
 * @returns {string}         - Signed JWT access token
 * ─────────────────────────────────────────────────────────
 */
function sign_access_token(user) {
    return jwt.sign(
        { user_id: user.id, email: user.email, role: user.role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );
}

/*
 * FUNCTION : sign_refresh_token
 * ─────────────────────────────────────────────────────────
 * WHY      : Refresh tokens are long-lived (7 days) and stored
 *            hashed in the DB; separating their signing keeps
 *            the secrets and expiry clearly distinct.
 *
 * HOW      : 1. Build minimal payload (user_id only)
 *            2. Sign with JWT_REFRESH_SECRET + 7 day expiry
 *            3. Return the signed string (caller hashes before storage)
 *
 * @param   {string}   user_id  - User's primary key
 * @returns {string}            - Signed JWT refresh token (raw, unhashed)
 * ─────────────────────────────────────────────────────────
 */
function sign_refresh_token(user_id) {
    return jwt.sign(
        { user_id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );
}

// ─── Exported service functions ───────────────────────────────────────────────

/*
 * FUNCTION : register_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Encapsulates all registration validation and user
 *            creation so the controller stays thin and rules
 *            (min lengths, uniqueness) are enforced in one place.
 *
 * HOW      : 1. Validate username (≥3 chars), email format,
 *               password (≥8 chars)
 *            2. Check that email is not already registered
 *            3. Hash password with bcrypt
 *            4. Create user via user_model (role defaults to USER)
 *            5. Return the created user (no password)
 *
 * @param   {string}   username  - Desired display name (min 3 chars)
 * @param   {string}   email     - Valid email address
 * @param   {string}   password  - Plaintext password (min 8 chars)
 * @returns {object}             - Created user (no password field)
 * @throws  {Error}              - 400 on validation failure
 * @throws  {Error}              - 409 if email already in use
 * ─────────────────────────────────────────────────────────
 */
async function register_user(username, email, password) {
    // Validate username length
    if (!username || username.trim().length < 3) {
        const err = new Error('Username must be at least 3 characters.');
        err.status = 400;
        throw err;
    }

    // Validate email format with a minimal RFC-style regex
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !email_regex.test(email)) {
        const err = new Error('A valid email address is required.');
        err.status = 400;
        throw err;
    }

    // Validate password length
    if (!password || password.length < 8) {
        const err = new Error('Password must be at least 8 characters.');
        err.status = 400;
        throw err;
    }

    // Guard against duplicate registrations
    const existing = await user_model.find_by_email(email.toLowerCase());
    if (existing) {
        const err = new Error('An account with this email already exists.');
        err.status = 409;
        throw err;
    }

    const hashed_password = await bcrypt.hash(password, SALT_ROUNDS);

    const new_user = await user_model.create_user({
        username: username.trim(),
        email: email.toLowerCase(),
        password: hashed_password,
        // role and ai_daily_limit default to USER / 10 in the schema
    });

    return new_user;
}

/*
 * FUNCTION : login_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Handles the full credential-verification and
 *            dual-token issuance flow. Centralising this
 *            prevents scattered JWT logic in the controller.
 *
 * HOW      : 1. Look up user by email (includes password hash)
 *            2. Reject if user not found or bcrypt mismatch
 *            3. Reject if account is deactivated (is_active = false)
 *            4. Sign a 15-min access token
 *            5. Sign a 7-day refresh token, hash it with bcrypt
 *            6. Persist the hash to RefreshToken table
 *            7. Update last_login_at
 *            8. Return { access_token, refresh_token (raw), token_id, user }
 *
 * @param   {string}   email       - User's registered email
 * @param   {string}   password    - Plaintext password to verify
 * @param   {string}   user_agent  - Request User-Agent header value
 * @param   {string}   ip_address  - Request IP address
 * @returns {object}               - { access_token, refresh_token, token_id, user }
 * @throws  {Error}                - 401 on bad credentials or inactive account
 * ─────────────────────────────────────────────────────────
 */
async function login_user(email, password, user_agent, ip_address) {
    const user = await user_model.find_by_email(email?.toLowerCase());

    // Use a generic message to avoid leaking whether the email exists
    const invalid_err = new Error('Invalid email or password.');
    invalid_err.status = 401;

    if (!user) throw invalid_err;

    const password_matches = await bcrypt.compare(password, user.password);
    if (!password_matches) throw invalid_err;

    // Separate check — give a clearer message once we know the account exists
    if (!user.is_active) {
        const err = new Error('Your account has been deactivated. Contact support.');
        err.status = 401;
        throw err;
    }

    const access_token = sign_access_token(user);
    const raw_refresh_token = sign_refresh_token(user.id);

    // Hash the refresh JWT before DB storage — raw token goes to cookie only
    const hashed_refresh = await bcrypt.hash(raw_refresh_token, SALT_ROUNDS);

    const refresh_expiry = new Date();
    refresh_expiry.setDate(refresh_expiry.getDate() + 7);

    const token_record = await refresh_token_model.create_token(
        user.id,
        hashed_refresh,
        refresh_expiry,
        user_agent,
        ip_address
    );

    await user_model.update_last_login(user.id);

    // Strip password before returning user object
    const { password: _omit, ...safe_user } = user;

    return {
        access_token,
        refresh_token: raw_refresh_token,  // controller puts this in httpOnly cookie
        token_id: token_record.id,         // controller stores id in cookie too (for logout)
        user: safe_user,
    };
}

/*
 * FUNCTION : refresh_access_token
 * ─────────────────────────────────────────────────────────
 * WHY      : The 15-min access token expires frequently; this
 *            function issues a new one without forcing re-login
 *            by validating the long-lived refresh token stored
 *            in the user's httpOnly cookie.
 *
 * HOW      : 1. Verify the refresh JWT signature + expiry
 *            2. Load all valid (non-revoked, non-expired) tokens
 *               for this user from the DB
 *            3. bcrypt.compare the incoming raw token against
 *               each stored hash until a match is found
 *            4. Reject if no match (token was tampered or revoked)
 *            5. Load the full user record
 *            6. Sign and return a new access token
 *
 * @param   {string}   refresh_token_from_cookie  - Raw JWT from httpOnly cookie
 * @returns {object}                              - { access_token, user }
 * @throws  {Error}                               - 401 on invalid/expired/revoked token
 * ─────────────────────────────────────────────────────────
 */
async function refresh_access_token(refresh_token_from_cookie) {
    if (!refresh_token_from_cookie) {
        const err = new Error('Refresh token is required.');
        err.status = 401;
        throw err;
    }

    // Verify the JWT signature first — catches forgeries and expired tokens
    let payload;
    try {
        payload = jwt.verify(refresh_token_from_cookie, process.env.JWT_REFRESH_SECRET);
    } catch {
        const err = new Error('Invalid or expired refresh token.');
        err.status = 401;
        throw err;
    }

    const { user_id } = payload;

    // Load all active token hashes for this user, then find matching hash
    const valid_tokens = await refresh_token_model.find_valid_token(user_id);

    let matched_token = null;
    for (const token_row of valid_tokens) {
        const is_match = await bcrypt.compare(refresh_token_from_cookie, token_row.token);
        if (is_match) {
            matched_token = token_row;
            break;
        }
    }

    if (!matched_token) {
        // Token is valid JWT but not in DB — possible token theft; reject
        const err = new Error('Refresh token not recognised. Please log in again.');
        err.status = 401;
        throw err;
    }

    const user = await user_model.find_by_id(user_id);
    if (!user || !user.is_active) {
        const err = new Error('User account is inactive or not found.');
        err.status = 401;
        throw err;
    }

    const access_token = sign_access_token(user);
    return { access_token, user };
}

/*
 * FUNCTION : logout_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Revoking the refresh token DB record ensures the
 *            cookie cannot be replayed even if it is stolen
 *            after the user has explicitly logged out.
 *
 * HOW      : 1. Accept the token_id stored alongside the cookie
 *            2. Call refresh_token_model.revoke_token to set
 *               revoked_at = now on that specific row
 *
 * @param   {string}   token_id  - Primary key of the RefreshToken row
 * @returns {void}
 * @throws  {Error}              - If token_id is missing or DB error
 * ─────────────────────────────────────────────────────────
 */
async function logout_user(token_id) {
    if (!token_id) {
        // Nothing to revoke — treat as success (idempotent logout)
        return;
    }
    await refresh_token_model.revoke_token(token_id);
}

/*
 * FUNCTION : get_current_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides the /auth/me endpoint with a fresh
 *            DB read so the response always reflects the
 *            current state (role changes, deactivation, etc.)
 *            rather than potentially stale token claims.
 *
 * HOW      : 1. Load user by ID via user_model
 *            2. Throw 404 if not found
 *            3. Return the safe user object
 *
 * @param   {string}   user_id  - Extracted from the verified access token
 * @returns {object}            - User record without password
 * @throws  {Error}             - 404 if user no longer exists
 * ─────────────────────────────────────────────────────────
 */
async function get_current_user(user_id) {
    const user = await user_model.find_by_id(user_id);
    if (!user) {
        const err = new Error('User not found.');
        err.status = 404;
        throw err;
    }
    return user;
}

/*
 * FUNCTION : change_password
 * ─────────────────────────────────────────────────────────
 * WHY      : Allows a user to update their own password.
 *            Requires current password to prevent unauthorized changes.
 * @param   {string}   user_id
 * @param   {string}   current_password
 * @param   {string}   new_password
 * @returns {object}   Success message
 * @throws  {Error}    400 if current password wrong or new password too short
 * ─────────────────────────────────────────────────────────
 */
async function change_password(user_id, current_password, new_password) {
    // Validate new_password FIRST (cheap check) before the slow bcrypt.compare
    if (!new_password || new_password.length < 8) {
        const err = new Error('Password must be at least 8 characters');
        err.status = 400;
        throw err;
    }

    const user = await user_model.find_by_id_with_password(user_id);
    if (!user) {
        const err = new Error('User not found.');
        err.status = 404;
        throw err;
    }

    // Verify current password — bcrypt.compare is intentionally slow (~100ms)
    const password_matches = await bcrypt.compare(current_password, user.password);
    if (!password_matches) {
        const err = new Error('Current password is incorrect.');
        err.status = 400;
        throw err;
    }

    const hashed_password = await bcrypt.hash(new_password, SALT_ROUNDS);
    await user_model.update_password(user_id, hashed_password);
    
    return { message: 'Password updated successfully' };
}

module.exports = {
    register_user,
    login_user,
    refresh_access_token,
    logout_user,
    get_current_user,
    change_password,
};