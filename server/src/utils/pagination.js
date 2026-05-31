/*
 * ============================================================
 * FILE    : pagination.js
 * LAYER   : Utility
 * PURPOSE : Centralize calculation of skip/limit and formatting
 *           standard paginated response objects across all services.
 * DEPENDS : None
 * ============================================================
 * EXPORTS:
 *   - get_pagination_params   : returns { skip, limit, page }
 *   - format_paginated_response : returns { data, pagination: { ... } }
 * ============================================================
 */

/**
 * Calculates Prisma skip/take based on page/limit query params.
 * 
 * @param {object} query - Express req.query
 * @param {number} default_limit - default if not provided
 * @param {number} max_limit - safety cap
 * @returns {object} { skip, take, page, limit }
 */
function get_pagination_params(query, default_limit = 10, max_limit = 100) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(
        max_limit,
        Math.max(1, parseInt(query.limit) || default_limit)
    );
    const skip = (page - 1) * limit;

    return { skip, take: limit, page, limit };
}

/**
 * Standardizes the shape of all paginated list responses.
 * 
 * @param {Array}  data - the array of items (rows)
 * @param {number} total - total count from the DB
 * @param {number} page - current page number
 * @param {number} limit - items per page
 * @returns {object} { data, pagination: { total, page, limit, total_pages } }
 */
function format_paginated_response(data, total, page, limit) {
    return {
        data,
        pagination: {
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
        },
    };
}

module.exports = {
    get_pagination_params,
    format_paginated_response,
};
