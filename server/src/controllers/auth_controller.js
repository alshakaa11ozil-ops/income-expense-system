/*
 * ============================================================
 * FILE    : auth_controller.js
 * LAYER   : Controller
 * PURPOSE : Parse HTTP requests and delegate to auth_service;
 *           handles cookie management (set / clear) for refresh tokens
 * DEPENDS : auth_service
 * ============================================================
 * EXPORTS:
 *   - register    : POST /api/auth/register
 *   - login       : POST /api/auth/login
 *   - refresh     : POST /api/auth/refresh
 *   - logout      : POST /api/auth/logout
 *   - get_me      : GET  /api/auth/me
 *   - change_password : PATCH /api/auth/me/password
 * ============================================================
 */

const auth_service = require('../services/auth_service');
const { send_success } = require('../utils/api_response');

// Shared cookie options — httpOnly prevents JS access (XSS protection)
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/*
 * FUNCTION : register
 * ─────────────────────────────────────────────────────────
 * WHY      : Entry point for new user creation via HTTP POST.
 * HOW      : 1. Extract fields from body
 *            2. Delegate to auth_service.register_user
 *            3. Return 201 with created user
 * @param   {object}  req  - Express request ({ body: { username, email, password } })
 * @param   {object}  res  - Express response
 * @param   {function} next - Express error handler
 * ─────────────────────────────────────────────────────────
 */
async function register(req, res, next) {
    try {
        const { username, email, password } = req.body;
        const user = await auth_service.register_user(username, email, password);
        return send_success(res, user, 201);
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : login
 * ─────────────────────────────────────────────────────────
 * WHY      : Authenticates credentials and issues dual tokens.
 * HOW      : 1. Extract credentials + client metadata
 *            2. Delegate to auth_service.login_user
 *            3. Set refresh_token + token_id in httpOnly cookies
 *            4. Return access_token + user in JSON body
 * @param   {object}  req  - Express request
 * @param   {object}  res  - Express response
 * @param   {function} next - Express error handler
 * ─────────────────────────────────────────────────────────
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const user_agent = req.headers['user-agent'] || '';
        const ip_address = req.ip;

        const { access_token, refresh_token, token_id, user } =
            await auth_service.login_user(email, password, user_agent, ip_address);

        // Refresh token stays in httpOnly cookie only — never exposed in body
        res.cookie('refresh_token', refresh_token, COOKIE_OPTIONS);

        // Store token_id alongside so logout can revoke the exact DB row
        res.cookie('token_id', token_id, COOKIE_OPTIONS);

        return send_success(res, { access_token, user });
    } catch (err) {
        next(err);
    }
}

/* 
 * FUNCTION : refresh
 * ─────────────────────────────────────────────────────────
 * WHY      : Issues a new short-lived access token without
 *            forcing the user to re-enter their password.
 * HOW      : 1. Read refresh_token from httpOnly cookie
 *            2. Delegate to auth_service.refresh_access_token
 *            3. Return new access_token in JSON body
 * @param   {object}  req  - Express request
 * @param   {object}  res  - Express response
 * @param   {function} next - Express error handler
 * ─────────────────────────────────────────────────────────
 */
async function refresh(req, res, next) {
    try {
        const refresh_token = req.cookies?.refresh_token;
        const { access_token, user } = await auth_service.refresh_access_token(refresh_token);
        return send_success(res, { access_token, user });
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : logout
 * ─────────────────────────────────────────────────────────
 * WHY      : Revokes the DB token record and clears both
 *            cookies so the session cannot be replayed.
 * HOW      : 1. Read token_id from cookie
 *            2. Delegate revocation to auth_service.logout_user
 *            3. Clear both httpOnly cookies
 *            4. Return 200 success
 * @param   {object}  req  - Express request
 * @param   {object}  res  - Express response
 * @param   {function} next - Express error handler
 * ─────────────────────────────────────────────────────────
 */
async function logout(req, res, next) {
    try {
        const token_id = req.cookies?.token_id;
        await auth_service.logout_user(token_id);

        res.clearCookie('refresh_token', COOKIE_OPTIONS);
        res.clearCookie('token_id', COOKIE_OPTIONS);

        return send_success(res, { message: 'Logged out successfully.' });
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : get_me
 * ─────────────────────────────────────────────────────────
 * WHY      : Returns the authenticated user's current profile
 *            so the frontend can re-hydrate its auth state.
 * HOW      : 1. user_id is already on req.user (set by attach_user middleware)
 *            2. Delegate to auth_service.get_current_user
 *            3. Return user in JSON body
 * @param   {object}  req  - Express request (req.user set by middleware)
 * @param   {object}  res  - Express response
 * @param   {function} next - Express error handler
 * ─────────────────────────────────────────────────────────
 */
async function get_me(req, res, next) {
    try {
        const user = await auth_service.get_current_user(req.user.id);
        return send_success(res, user);
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : change_password
 * ─────────────────────────────────────────────────────────
 * WHY      : Thin dispatcher to handle password change
 * HOW      : Delegate to auth_service.change_password
 * @param   {object}  req
 * @param   {object}  res
 * @param   {function} next
 * ─────────────────────────────────────────────────────────
 */
async function change_password(req, res, next) {
    try {
        const result = await auth_service.change_password(
            req.user.id,
            req.body.current_password,
            req.body.new_password
        );
        return send_success(res, result);
    } catch (err) {
        next(err);
    }
}

module.exports = { register, login, refresh, logout, get_me, change_password };