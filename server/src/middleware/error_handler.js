/*
 * ============================================================
 * FILE    : error_handler.js
 * LAYER   : Middleware
 * PURPOSE : Global Express error handler. Converts thrown errors into
 *           consistent JSON responses. Must be registered LAST in app.js
 *           after all routes so it catches errors from every layer.
 * DEPENDS : utils/api_response
 * ============================================================
 * EXPORTS:
 *   - error_handler  : Express 4-argument error middleware
 * ============================================================
 */

/*
 * FUNCTION : error_handler
 * ─────────────────────────────────────────────────────────
 * WHY      : Centralises all error-to-response conversion so individual
 *            controllers only need to call next(err) and never build
 *            their own error responses. This ensures every error —
 *            validation, auth, AI limits, unexpected crashes — comes
 *            back in the same { success, error, ... } shape.
 *
 * HOW      : 1. Log the error for server-side debugging
 *            2. Handle 429 (AI daily limit) — include reset_at, used, limit
 *               fields so the client can display a meaningful countdown
 *            3. Handle known AI errors by status code (502 for Gemini failures)
 *            4. Handle Prisma errors (P2002 unique constraint, P2025 not found)
 *            5. Handle JWT errors from jsonwebtoken library
 *            6. Default to 500 for anything unexpected
 *
 * @param   {Error}     err   - The thrown error (may have .status, .reset_at, etc.)
 * @param   {Request}   req
 * @param   {Response}  res
 * @param   {Function}  next  - Must be declared even if unused (Express signature)
 * ─────────────────────────────────────────────────────────
 */
function error_handler(err, req, res, next) { // eslint-disable-line no-unused-vars
    // Always log to server output — never swallow errors silently
    console.error(`[error_handler] ${req.method} ${req.path} →`, err.message);

    // ── 429 Daily AI limit ────────────────────────────────────────────────────
    // WHY: run_with_cache in ai_service throws with extra fields (reset_at, used,
    //      limit) that the client needs to display a useful "try again at X" message.
    if (err.status === 429) {
        return res.status(429).json({
            success: false,
            error: err.message || 'Too many requests',
            reset_at: err.reset_at ?? null,
            used: err.used ?? null,
            limit: err.limit ?? null,
        });
    }

    // ── 502 Gemini / AI upstream errors ──────────────────────────────────────
    if (err.status === 502) {
        return res.status(502).json({
            success: false,
            error: err.message || 'AI service unavailable',
            code: err.message.startsWith('AI_') ? err.message.split(':')[0] : 'AI_ERROR',
        });
    }

    // ── 401 Unauthorised (JWT errors) ─────────────────────────────────────────
    if (
        err.name === 'JsonWebTokenError' ||
        err.name === 'TokenExpiredError' ||
        err.status === 401
    ) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorised — invalid or expired token',
            code: 'AUTH_ERROR',
        });
    }

    // ── 403 Forbidden ─────────────────────────────────────────────────────────
    if (err.status === 403) {
        return res.status(403).json({
            success: false,
            error: err.message || 'Access denied',
            code: 'FORBIDDEN',
        });
    }

    // ── 404 Not Found ─────────────────────────────────────────────────────────
    if (err.status === 404) {
        return res.status(404).json({
            success: false,
            error: err.message || 'Resource not found',
            code: 'NOT_FOUND',
        });
    }

    // ── 400 Validation / bad request ──────────────────────────────────────────
    if (err.status === 400) {
        return res.status(400).json({
            success: false,
            error: err.message || 'Bad request',
            code: 'VALIDATION_ERROR',
        });
    }

    // ── Prisma known error codes ──────────────────────────────────────────────
    if (err.code === 'P2002') {
        // Unique constraint violation — e.g. duplicate record ID or email
        return res.status(409).json({
            success: false,
            error: 'A record with this value already exists',
            code: 'DUPLICATE_ERROR',
        });
    }

    if (err.code === 'P2025') {
        // Record not found in a required relation or update target
        return res.status(404).json({
            success: false,
            error: 'Record not found',
            code: 'NOT_FOUND',
        });
    }

    // ── Budget Goal Policies ──────────────────────────────────────────────────
    // budget_goal_service.js throws plain Error objects with these prefixes
    // for policy violations. Map to 400 Bad Request.
    if (
        err.message?.startsWith('Cannot edit goals') ||
        err.message?.startsWith('Cannot plan more than')
    ) {
        return res.status(400).json({
            success: false,
            error: err.message,
            code: 'BUDGET_POLICY_ERROR',
        });
    }

    // ── Fallback: unexpected 500 ───────────────────────────────────────────────
    // WHY: Never expose internal stack traces to clients in production.
    //      Log the full error above; return a generic message below.
    return res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
    });
}

module.exports = { error_handler };