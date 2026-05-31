/*
 * ============================================================
 * FILE    : auth_middleware.js
 * LAYER   : Middleware
 * PURPOSE : Verify JWT access tokens, enforce account status,
 *           attach user context to req, and gate role-based routes
 * DEPENDS : jsonwebtoken, user_model
 * ============================================================
 * EXPORTS:
 *   - verify_access_token  : validates Bearer JWT, attaches payload to req.user
 *   - check_user_is_active : rejects 403 if the account is deactivated
 *   - attach_user          : combined convenience middleware (verify + active check)
 *   - require_role         : factory that returns a role-gate middleware
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const user_model = require('../models/user_model');
const { send_error } = require('../utils/api_response');

/*
 * FUNCTION : verify_access_token
 * ─────────────────────────────────────────────────────────
 * WHY      : Every protected route needs the caller's identity
 *            confirmed before any business logic runs.
 *            Centralising this prevents scattered jwt.verify calls.
 *
 * HOW      : 1. Extract "Bearer <token>" from Authorization header
 *            2. Reject 401 if header is missing or malformed
 *            3. Verify signature and expiry with JWT_ACCESS_SECRET
 *            4. Attach decoded payload ({ user_id, email, role }) to req.token_payload
 *            5. Call next() on success
 *
 * @param   {object}   req   - Express request
 * @param   {object}   res   - Express response
 * @param   {function} next  - Express next middleware
 * @returns {void}
 * ─────────────────────────────────────────────────────────
 */
function verify_access_token(req, res, next) {
    const auth_header = req.headers.authorization;

    if (!auth_header || !auth_header.startsWith('Bearer ')) {
        return send_error(res, 'Access token is required.', 401, 'TOKEN_MISSING');
    }

    const token = auth_header.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.token_payload = payload; // { user_id, email, role, iat, exp }
        next();
    } catch (err) {
        // Distinguish expired from invalid so the client can decide to refresh
        const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        return send_error(res, err.message, 401, code);
    }
}

/*
 * FUNCTION : check_user_is_active
 * ─────────────────────────────────────────────────────────
 * WHY      : An admin can deactivate an account at any time.
 *            The JWT is still cryptographically valid until it
 *            expires, so we must check the live DB flag on
 *            every request rather than relying on token claims.
 *
 * HOW      : 1. Assume verify_access_token already ran (req.token_payload set)
 *            2. Load fresh user record from DB via user_model
 *            3. Return 403 if user not found or is_active = false
 *            4. Attach full user object to req.user
 *            5. Call next() if account is active
 *
 * @param   {object}   req   - Express request (req.token_payload.user_id required)
 * @param   {object}   res   - Express response
 * @param   {function} next  - Express next middleware
 * @returns {void}
 * ─────────────────────────────────────────────────────────
 */
async function check_user_is_active(req, res, next) {
    try {
        const user = await user_model.find_by_id(req.token_payload.user_id);

        if (!user || !user.is_active) {
            return send_error(res, 'Your account has been deactivated.', 403, 'ACCOUNT_INACTIVE');
        }

        // Attach full user object to req.user for use in controllers
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
}

/*
 * FUNCTION : attach_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Most protected routes need both token verification
 *            AND the active-account check. This composite
 *            middleware reduces boilerplate in route files.
 *
 * HOW      : 1. Run verify_access_token first
 *            2. If that calls next(), run check_user_is_active
 *            3. Both must pass before the route handler is reached
 *
 * Usage in routes:
 *   router.get('/profile', attach_user, profile_controller.get_profile)
 *
 * @param   {object}   req   - Express request
 * @param   {object}   res   - Express response
 * @param   {function} next  - Express next middleware
 * @returns {void}
 * ─────────────────────────────────────────────────────────
 */
function attach_user(req, res, next) {
    // Chain: verify token → then check active status
    verify_access_token(req, res, (err) => {
        if (err) return next(err);
        check_user_is_active(req, res, next);
    });
}

/*
 * FUNCTION : require_role
 * ─────────────────────────────────────────────────────────
 * WHY      : Some routes (admin panel) must be inaccessible
 *            to regular users. This factory creates reusable
 *            role-gate middleware without code duplication.
 *
 * HOW      : 1. Accept an array of allowed role strings
 *            2. Return a middleware function that checks
 *               req.user.role against the allowed list
 *            3. Call next() on match; return 403 otherwise
 *
 * Usage:
 *   router.delete('/admin/hard', attach_user, require_role(['ADMIN']), handler)
 *
 * @param   {string[]} allowed_roles  - Roles permitted to access the route
 * @returns {function}                - Express middleware function
 * ─────────────────────────────────────────────────────────
 */
function require_role(allowed_roles) {
    return function role_gate(req, res, next) {
        // req.user must be set by attach_user before this middleware runs
        if (!req.user || !allowed_roles.includes(req.user.role)) {
            return send_error(res, 'You do not have permission to access this resource.', 403, 'FORBIDDEN');
        }
        next();
    };
}

module.exports = {
    verify_access_token,
    check_user_is_active,
    attach_user,
    require_role,
};