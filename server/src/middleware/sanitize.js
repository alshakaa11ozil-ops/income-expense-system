/*
 * ============================================================
 * FILE    : sanitize.js
 * LAYER   : Middleware
 * PURPOSE : Strip HTML tags from all string fields in req.body
 *           before any route handler processes the request.
 *           Prevents XSS payloads being stored in the database
 *           or injected into AI prompts.
 * DEPENDS : None — uses only built-in string methods
 * ============================================================
 * EXPORTS:
 *   - sanitize_body : Express middleware, mutates req.body in place
 * ============================================================
 */

/*
 * FUNCTION : strip_html
 * WHY      : Remove HTML tags from a string. A user submitting
 *            "<script>...</script>" as a category name or AI question
 *            must never have that stored or forwarded to Gemini.
 * HOW      : Replace all content matching /<[^>]*>/g with empty string.
 *            Also trim whitespace after stripping.
 * @param   {string} value
 * @returns {string}
 */
function strip_html(value) {
    return value.replace(/<[^>]*>/g, '').trim();
}

/*
 * FUNCTION : sanitize_value
 * WHY      : Recursively sanitizes any value — handles nested objects
 *            and arrays so deeply nested fields in req.body are also
 *            cleaned (e.g. goals[0].category_id is still a string).
 * HOW      : 1. If string → strip_html
 *            2. If array  → map each element through sanitize_value
 *            3. If plain object → sanitize each value recursively
 *            4. Anything else (number, boolean, null) → return as-is
 * @param   {any} value
 * @returns {any}
 */
function sanitize_value(value) {
    if (typeof value === 'string') return strip_html(value);
    if (Array.isArray(value)) return value.map(sanitize_value);
    if (value !== null && typeof value === 'object') {
        const result = {};
        for (const key of Object.keys(value)) {
            result[key] = sanitize_value(value[key]);
        }
        return result;
    }
    return value;
}

/*
 * FUNCTION : sanitize_body
 * WHY      : Applied globally before all routes so no handler ever
 *            receives unsanitized string input. One middleware protects
 *            all 30+ endpoints without touching each one individually.
 * HOW      : Mutates req.body in place using sanitize_value.
 *            Calls next() immediately — this is not async.
 * @param   {Request}  req
 * @param   {Response} res
 * @param   {Function} next
 */
function sanitize(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitize_value(req.body);
    }
    next();
}

module.exports = { sanitize };