/*
 * ============================================================
 * FILE    : rate_limiter.js
 * LAYER   : Middleware
 * PURPOSE : Provide pre-configured express-rate-limit instances
 *           to protect auth endpoints against brute-force and
 *           automated registration abuse
 * DEPENDS : express-rate-limit
 * ============================================================
 * EXPORTS:
 *   - login_limiter    : 10 requests / IP / 15 min (brute-force guard)
 *   - register_limiter : 5 requests / IP / hour (spam account guard)
 * ============================================================
 */

const rate_limit = require('express-rate-limit');

/*
 * FUNCTION : login_limiter (factory result)
 * ─────────────────────────────────────────────────────────
 * WHY      : Without rate limiting, an attacker can enumerate
 *            passwords at thousands of attempts per second.
 *            10 attempts per 15 minutes stops brute-force
 *            while allowing a forgetful human to retry.
 *
 * HOW      : 1. express-rate-limit tracks attempts by IP
 *            2. After 10 requests in a 15-min window it returns 429
 *            3. The window slides so the counter resets after 15 min
 *            4. standardHeaders + legacyHeaders configure RateLimit
 *               response headers per the IETF draft standard
 *
 * @returns {function}  - Express middleware
 * ─────────────────────────────────────────────────────────
 */
const login_limiter = rate_limit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,
    standardHeaders: true,   // adds RateLimit-* headers (IETF draft)
    legacyHeaders: false,     // disables deprecated X-RateLimit-* headers
    message: {
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    // WHY no keyGenerator: express-rate-limit v8 keys by IP by default
    // with correct IPv6 handling. Custom keyGenerator: req => req.ip
    // triggers ERR_ERL_KEY_GEN_IPV6 validation error in v8+.
});

/*
 * FUNCTION : register_limiter (factory result)
 * ─────────────────────────────────────────────────────────
 * WHY      : Automated bots can generate thousands of throwaway
 *            accounts in seconds. 5 registrations per IP per hour
 *            stops scripted abuse without blocking real users
 *            (who rarely need more than 1–2 signups per hour).
 *
 * HOW      : 1. Same IP-keyed sliding-window approach as login_limiter
 *            2. Tighter limit (5) over a longer window (1 hour)
 *            3. Returns 429 JSON matching the project error format
 *
 * @returns {function}  - Express middleware
 * ─────────────────────────────────────────────────────────
 */
const register_limiter = rate_limit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many accounts created from this IP. Please try again in an hour.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    // WHY no keyGenerator: same reason as login_limiter above
});

module.exports = { login_limiter, register_limiter };