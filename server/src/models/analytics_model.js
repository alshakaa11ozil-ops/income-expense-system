/*
 * ============================================================
 * FILE    : analytics_model.js
 * LAYER   : Model
 * PURPOSE : Raw Prisma aggregation queries for analytics.
 *           Returns Prisma Decimal objects and grouped data.
 *           Zero calculation logic — that lives in analytics_service.js.
 * DEPENDS : src/config/database.js (Prisma singleton)
 * ============================================================
 * EXPORTS:
 *   - get_totals_by_type            : SUM income/expense for a given month
 *   - get_records_for_trends        : Minimal record fetch for trend grouping
 *   - get_expense_totals_by_category: GROUP BY category for pie chart
 *   - get_records_for_daily_balance : Ordered records for running total calc
 *   - get_balance_before_date       : Net balance of all records before a date (starting point)
 *   - get_system_totals             : Admin-only cross-user aggregation
 * ============================================================
 */

const prisma = require('../config/database');

/*
 * FUNCTION : get_totals_by_type
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides raw income and expense SUM for a given month.
 *            PostgreSQL SUM aggregation is far more efficient than
 *            fetching all rows and summing in JavaScript — avoids
 *            loading potentially thousands of records into memory.
 *
 * HOW      : 1. Build date range: first day of month to first day of next month
 *            2. prisma.record.groupBy on type field
 *            3. Filter: user_id, deleted_at: null, date in range
 *            4. Aggregate: _sum amount, _count id
 *            5. Return raw groupBy result array
 *
 * @param   {string} user_id  - The authenticated user's ID
 * @param   {number} month    - Month number 1–12
 * @param   {number} year     - Four-digit year e.g. 2026
 * @returns {Promise<Array>}  - [{ type, _sum: { amount }, _count: { id } }]
 * @throws  {Error}           - Prisma query failure
 * ─────────────────────────────────────────────────────────
 */
async function get_totals_by_type(user_id, month, year) {
    // Build date range for the target month — gte/lt avoids timezone edge cases
    const date_start = new Date(year, month - 1, 1);   // first day of month
    const date_end = new Date(year, month, 1);        // first day of NEXT month

    return prisma.record.groupBy({
        by: ['type'],
        where: {
            user_id,
            deleted_at: null,  // never include soft-deleted records in totals
            date: {
                gte: date_start,
                lt: date_end,
            },
        },
        _sum: { amount: true },
        _count: { id: true },
    });
}

/*
 * FUNCTION : get_records_for_trends
 * ─────────────────────────────────────────────────────────
 * WHY      : Fetches lightweight record data for the line chart.
 *            The service groups these by month label after fetching.
 *            SELECT only the three needed columns — never load full rows
 *            when a subset suffices.
 *
 * HOW      : 1. Calculate start_date = today minus months_back calendar months
 *            2. Query with minimal select: date, type, amount only
 *            3. Filter: user_id, deleted_at: null, date >= start_date
 *            4. Order by date ascending so the service can iterate in order
 *
 * @param   {string} user_id      - The authenticated user's ID
 * @param   {number} months_back  - How many months of history to fetch
 * @returns {Promise<Array>}      - [{ date, type, amount }]
 * @throws  {Error}               - Prisma query failure
 * ─────────────────────────────────────────────────────────
 */
async function get_records_for_trends(user_id, months_back) {
    const now = new Date();
    // Roll back to the first day of the earliest month we need
    const start_date = new Date(now.getFullYear(), now.getMonth() - (months_back - 1), 1);

    return prisma.record.findMany({
        where: {
            user_id,
            deleted_at: null,  // soft-deleted records must not appear in trend data
            date: {
                gte: start_date,
            },
        },
        select: {
            date: true,
            type: true,
            amount: true,
        },
        orderBy: { date: 'asc' },
    });
}

/*
 * FUNCTION : get_expense_totals_by_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Powers the pie chart and budget goal progress bars.
 *            Groups expense records by category and sums amounts.
 *            Income is intentionally excluded — category breakdown
 *            is meaningful for spending analysis, not income.
 *
 * HOW      : 1. Build date range for the target month
 *            2. prisma.record.groupBy on category field
 *               (Prisma groupBy does not support include/join,
 *                so category details are merged in the service)
 *            3. Filter: user_id, deleted_at: null, type: 'expense', date in range
 *            4. Aggregate: _sum amount, _count id
 *            5. Return raw groupBy result
 *
 * @param   {string} user_id  - The authenticated user's ID
 * @param   {number} month    - Month number 1–12
 * @param   {number} year     - Four-digit year
 * @returns {Promise<Array>}  - [{ category, _sum: { amount }, _count: { id } }]
 * @throws  {Error}           - Prisma query failure
 * ─────────────────────────────────────────────────────────
 */
async function get_expense_totals_by_category(user_id, month, year) {
    const date_start = new Date(year, month - 1, 1);
    const date_end = new Date(year, month, 1);

    return prisma.record.groupBy({
        by: ['category_id'],
        where: {
            user_id,
            deleted_at: null,  // never count soft-deleted records
            type: 'expense',
            date: {
                gte: date_start,
                lt: date_end,
            },
        },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: {
            _sum: { amount: 'desc' }, // largest spending categories first
        },
    });
}

/*
 * FUNCTION : get_records_for_daily_balance
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides the ordered record stream needed to compute
 *            a running balance. Running totals require sequential
 *            iteration — they cannot be expressed as a single
 *            SQL aggregate, so this belongs in the service layer.
 *
 * HOW      : 1. Query records within the date range (inclusive on both ends)
 *            2. Select only date, type, amount — minimal payload
 *            3. Filter: user_id, deleted_at: null
 *            4. Order by date ascending — order matters for running total
 *
 * @param   {string} user_id   - The authenticated user's ID
 * @param   {Date}   date_from - Start of date range (inclusive)
 * @param   {Date}   date_to   - End of date range (inclusive)
 * @returns {Promise<Array>}   - [{ date, type, amount }] ordered by date asc
 * @throws  {Error}            - Prisma query failure
 * ─────────────────────────────────────────────────────────
 */
async function get_records_for_daily_balance(user_id, date_from, date_to) {
    return prisma.record.findMany({
        where: {
            user_id,
            deleted_at: null,  // soft-deleted records must not affect balance
            date: {
                gte: date_from,
                lte: date_to,
            },
        },
        select: {
            date: true,
            type: true,
            amount: true,
        },
        orderBy: { date: 'asc' },
    });
}

/*
 * FUNCTION : get_balance_before_date
 * ─────────────────────────────────────────────────────────
 * WHY      : Computes the user's net balance from all records strictly
 *            before a given date. This is the "starting point" for the
 *            daily balance chart — without it, viewing May in isolation
 *            starts at $0 even if the user has $5,000 carried from April.
 *            One aggregate query is far cheaper than fetching all prior
 *            records and summing them in JavaScript.
 *
 * HOW      : 1. prisma.record.groupBy type
 *               where: { user_id, deleted_at: null, date: { lt: before_date } }
 *               _sum: { amount: true }
 *            2. Return raw groupBy result — service computes net from it
 *
 * @param   {string} user_id      - The authenticated user's ID
 * @param   {Date}   before_date  - Exclusive upper bound (not included in result)
 * @returns {Promise<Array>}      - [{ type, _sum: { amount } }]
 * @throws  {Error}               - Prisma query failure
 * ─────────────────────────────────────────────────────────
 */
async function get_balance_before_date(user_id, before_date) {
    return prisma.record.groupBy({
        by: ['type'],
        where: {
            user_id,
            deleted_at: null,  // soft-deleted records must not affect historical balance
            date: {
                lt: before_date,  // strictly before date_from — not on the same day
            },
        },
        _sum: { amount: true },
    });
}

/*
 * FUNCTION : get_system_totals
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides admin-level system health metrics across ALL users.
 *            No user_id filter is intentional — admins see the entire
 *            platform's financial activity. This function must only ever
 *            be called from admin-protected routes.
 *
 * HOW      : 1. Run two queries inside a Prisma $transaction for consistency:
 *               a) prisma.user.count() — total registered users
 *               b) prisma.record.groupBy type (no user_id filter)
 *                  where: deleted_at: null
 *                  _sum: amount, _count: id
 *            2. Return both results together
 *
 * @returns {Promise<{ user_count: number, by_type: Array }>}
 * @throws  {Error} - Prisma query failure
 * ─────────────────────────────────────────────────────────
 */
async function get_system_totals() {
    const [user_count, by_type] = await prisma.$transaction([
        prisma.user.count(),
        prisma.record.groupBy({
            by: ['type'],
            where: {
                deleted_at: null,  // exclude soft-deleted from system totals
                // intentionally no user_id filter — admin sees all users
            },
            _sum: { amount: true },
            _count: { id: true },
        }),
    ]);

    return { user_count, by_type };
}
/*
 * FUNCTION : get_totals_for_range
 * ─────────────────────────────────────────────────────────
 * WHY      : The records page filtered-period summary bar needs
 *            income/expense totals for an arbitrary date range
 *            like "May 1 – June 2", not just a full calendar month.
 *            Same shape as get_totals_by_type so the service
 *            aggregation logic works identically for both.
 *
 * HOW      : prisma.record.groupBy on type
 *            where: user_id, deleted_at: null,
 *                   date: { gte: date_from, lte: date_to }
 *            _sum: amount, _count: id
 *
 * @param   {string} user_id
 * @param   {Date}   date_from  - Range start (inclusive)
 * @param   {Date}   date_to    - Range end (inclusive, caller sets to end-of-day)
 * @returns {Array}             - same shape as get_totals_by_type
 * ─────────────────────────────────────────────────────────
 */
async function get_totals_for_range(user_id, date_from, date_to) {
    return prisma.record.groupBy({
        by: ['type'],
        where: {
            user_id,
            deleted_at: null,
            date: {
                gte: date_from,
                lte: date_to,
            },
        },
        _sum: { amount: true },
        _count: { id: true },
    });
}

module.exports = {
    get_totals_by_type,
    get_records_for_trends,
    get_expense_totals_by_category,
    get_records_for_daily_balance,
    get_balance_before_date,
    get_system_totals,
    get_totals_for_range,
};