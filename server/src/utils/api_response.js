/*
 * ============================================================
 * FILE    : api_response.js
 * LAYER   : Utility
 * PURPOSE : Shared response helpers — guarantees consistent JSON shape
 *           across all controllers. Every controller uses these instead of
 *           building { success: true, data: ... } manually.
 * DEPENDS : express response object
 * ============================================================
 * EXPORTS:
 *   - send_success   : standard 200/201 success response
 *   - send_error     : standard error response with optional status/code
 *   - send_paginated : success response with pagination metadata
 * ============================================================
 */

/**
 * WHY: Success responses should always follow the same schema { success: true, data: ... }
 *      to make frontend consumption predictable.
 *
 * @param {object} res    - Express response object
 * @param {any}    data   - The data to return to the client
 * @param {number} status - HTTP status code (default 200)
 */
function send_success(res, data, status = 200) {
    return res.status(status).json({
        success: true,
        data,
    });
}

/**
 * WHY: Error responses need a consistent shape { success: false, error: "msg", code: "CODE" }
 *      so the frontend can handle specific errors (like TOKEN_EXPIRED) programmatically.
 *
 * @param {object} res     - Express response object
 * @param {string} message - Descriptive error message
 * @param {number} status  - HTTP status code (default 400)
 * @param {string} code    - Optional machine-readable error code
 */
function send_error(res, message, status = 400, code = null) {
    return res.status(status).json({
        success: false,
        error: message,
        ...(code && { code }),
    });
}

/**
 * WHY: Lists of records require metadata (total count, current page) to handle
 *      infinite scroll or numbered pagination on the frontend.
 *
 * @param {object} res        - Express response object
 * @param {Array}  data       - The array of records
 * @param {object} pagination - { total, page, limit, total_pages }
 */
function send_paginated(res, data, pagination) {
    return res.status(200).json({
        success: true,
        data,
        pagination,
    });
}

module.exports = {
    send_success,
    send_error,
    send_paginated,
};
