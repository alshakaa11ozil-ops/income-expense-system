/*
 * ============================================================
 * FILE    : utils/ai_error_helper.js
 * LAYER   : Utility
 * PURPOSE : Centralised AI error message resolver. All three AI
 *           components (ExpensePlanner, PurchaseAdvisor,
 *           AnalysisChat) handle the same error shapes from the
 *           backend. Defining the logic once here prevents the
 *           same switch from being duplicated three times.
 * DEPENDS : Nothing — pure functions, no imports
 * ============================================================
 * EXPORTS:
 *   - get_ai_error_message : Axios error → human-readable string
 *   - handle_ai_error      : Convenience wrapper for set_error pattern
 * ============================================================
 */

/*
 * FUNCTION : get_ai_error_message
 * ─────────────────────────────────────────────────────────
 * WHY      : The backend returns four distinct error shapes for
 *            AI routes. Each needs a different user-facing message:
 *            429 → quota info with reset time (from reset_at field)
 *            502 → transient upstream failure, try again
 *            400 → budget policy violation (past month etc.)
 *            network → server unreachable
 *            Without this centralised resolver each component
 *            would duplicate the same conditional chain.
 *
 * HOW      : 1. Extract status and data from the Axios error
 *            2. Switch on status code
 *            3. For 429: compute hours until reset_at (ISO string
 *               from error_handler.js which passes it through)
 *            4. For 400: forward backend message verbatim so budget
 *               policy wording is consistent with the API contract
 *            5. No-response case covers offline / CORS / timeout
 *
 * @param   {Error} err - Axios error object (err.response may be undefined)
 * @returns {string}    - user-friendly, non-technical message
 * ─────────────────────────────────────────────────────────
 */
export function get_ai_error_message(err) {
    const status = err.response?.status
    const data = err.response?.data

    if (status === 429) {
        // reset_at is an ISO timestamp forwarded by error_handler.js
        // WHY compute hours: "Resets in ~3 hours" is more meaningful
        // than a raw timestamp that users would have to mentally parse.
        const reset_at = data?.reset_at
        const hours_left = reset_at
            ? Math.ceil((new Date(reset_at) - new Date()) / 3_600_000)
            : '?'
        const used = data?.used ?? '?'
        const limit = data?.limit ?? '?'
        return `Daily AI limit reached (${used}/${limit} used). Resets in ~${hours_left} hour${hours_left === 1 ? '' : 's'}.`
    }

    if (status === 502) {
        // AI_UNAVAILABLE = Gemini API down; AI_PARSE_ERROR = Zod validation failed
        // WHY same message for both: users cannot act on the distinction —
        // both resolve by waiting and retrying.
        return 'AI service is temporarily unavailable. Please try again in a moment.'
    }

    if (status === 400 && data?.error) {
        // Forward budget policy messages verbatim so the wording
        // matches what the instructor sees in the backend spec.
        return data.error
    }

    if (!err.response) {
        // No response at all → network issue on the client side
        return 'Cannot reach the server. Check your connection and try again.'
    }

    return 'Something went wrong. Please try again.'
}

/*
 * FUNCTION : handle_ai_error
 * ─────────────────────────────────────────────────────────
 * WHY      : ExpensePlanner, PurchaseAdvisor, and AnalysisChat
 *            all use a single error state string (e.g. setError,
 *            setPlanError). This wrapper resolves the message and
 *            calls the setter in one line, keeping catch blocks
 *            in those components to a single expression.
 *
 * HOW      : 1. Call get_ai_error_message(err)
 *            2. Pass result to set_error setter
 *
 * @param   {Error}    err       - Axios error from the AI API call
 * @param   {Function} set_error - React state setter, e.g. setError
 * @returns {void}
 * ─────────────────────────────────────────────────────────
 */
export function handle_ai_error(err, set_error, show_toast) {
    const message = get_ai_error_message(err)
    if (set_error) set_error(message)
    if (show_toast) show_toast(message, 'error')
}