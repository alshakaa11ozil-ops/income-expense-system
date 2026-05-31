/*
 * ============================================================
 * FILE    : auth_routes.js
 * LAYER   : Route
 * PURPOSE : Map HTTP auth endpoints to controller handlers,
 *           applying rate limiters and auth middleware as required
 * DEPENDS : express, auth_controller, auth_middleware, rate_limiter
 * ============================================================
 * EXPORTS:
 *   - router  : Express Router with all /api/auth/* routes mounted
 * ============================================================
 */

const { Router } = require('express');
const auth_controller = require('../controllers/auth_controller');
const { attach_user } = require('../middleware/auth_middleware');
const { login_limiter, register_limiter } = require('../middleware/rate_limiter');

const router = Router();

/*
 * POST /api/auth/register
 * Rate-limited: 5 requests / IP / hour
 * No auth required — open endpoint for new account creation
 */
router.post('/register', register_limiter, auth_controller.register);

/*
 * POST /api/auth/login
 * Rate-limited: 10 requests / IP / 15 min (brute-force protection)
 * No auth required — issues access token + sets httpOnly cookie
 */
router.post('/login', login_limiter, auth_controller.login);

/*
 * POST /api/auth/refresh
 * No auth middleware — the refresh_token cookie IS the credential here.
 * auth_service validates it internally before issuing a new access token.
 */
router.post('/refresh', auth_controller.refresh);

/*
 * POST /api/auth/logout
 * Requires valid access token so we can resolve the token_id to revoke.
 * Cookie is cleared regardless of token state (idempotent design).
 */
router.post('/logout', attach_user, auth_controller.logout);

/*
 * GET /api/auth/me
 * Returns the current user's profile — always reads from DB (not cache)
 * so deactivation or role changes are immediately reflected.
 */
router.get('/me', attach_user, auth_controller.get_me);

module.exports = router;