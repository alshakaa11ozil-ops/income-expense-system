/*
 * ============================================================
 * FILE    : api/analytics.js
 * LAYER   : Service (HTTP — analytics domain)
 * PURPOSE : All API calls for the /analytics/* endpoints.
 *           Summary, trends, categories, and daily balance.
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - get_analytics_summary          : GET /analytics/summary (month/year)
 *   - get_analytics_summary_for_range: GET /analytics/summary (date range)
 *   - get_analytics_trends           : GET /analytics/trends
 *   - get_analytics_categories       : GET /analytics/categories
 *   - get_analytics_daily            : GET /analytics/daily
 * ============================================================
 */

import api from './client'

/*
 * FUNCTION : get_analytics_summary
 * WHY      : Fetches income/expense totals for a specific month.
 *            Used by the Dashboard (Chat 9) to show current-month
 *            summary cards.
 * @param   {number} month - 1–12
 * @param   {number} year  - e.g. 2026
 * @returns {{ total_income, total_expense, net_balance, record_count }}
 *          All amounts as strings: "1500.00"
 */
export async function get_analytics_summary(month, year, category_id) {
    const params = { month, year }
    if (category_id) params.category_id = category_id
    const response = await api.get('/analytics/summary', { params })
    return response.data.data
}

/*
 * FUNCTION : get_analytics_summary_for_range
 * WHY      : When the user applies a date range filter on the Records
 *            page, the period summary bar needs totals for that
 *            specific range (not the current month).
 *
 *            IMPORTANT: Verify analytics_controller.js has a branch
 *            for date_from/date_to params — if it only handles
 *            month/year, this returns nothing and the bar stays hidden.
 * @param   {string} date_from - "YYYY-MM-DD"
 * @param   {string} date_to   - "YYYY-MM-DD"
 * @returns {{ total_income, total_expense, net_balance, record_count }}
 */
export async function get_analytics_summary_for_range(date_from, date_to) {
    const response = await api.get('/analytics/summary', {
        params: { date_from, date_to },
    })
    return response.data.data
}

/*
 * FUNCTION : get_analytics_trends
 * WHY      : Returns monthly income vs expense for the line chart
 *            on the Dashboard. months_back controls the lookback
 *            window — Dashboard passes 6, AI advisor passes 3.
 *            Without this param the backend always defaults to 6
 *            and the caller has no control over the range.
 * @param   {number} months_back - default 6
 * @returns {MonthlyTrend[]} - [{ month, label, income, expense, net }]
 */
export async function get_analytics_trends(months_back = 6, category_id) {
    const params = { months_back }
    if (category_id) params.category_id = category_id
    const response = await api.get('/analytics/trends', { params })
    return response.data.data
}

/*
 * FUNCTION : get_analytics_categories
 * WHY      : Returns spending by category for the pie chart on
 *            the Dashboard. Month/year params are required so the
 *            chart reflects the selected month, not the server's
 *            module-load time default (which would be wrong after
 *            midnight on the first of a new month).
 * @param   {number} month - 1–12 (default: current month)
 * @param   {number} year  - e.g. 2026 (default: current year)
 * @returns {CategoryStat[]} - [{ category_id, category_name, icon, color, total, percentage }]
 */
export async function get_analytics_categories(month, year) {
    const now = new Date()
    const response = await api.get('/analytics/categories', {
        params: {
            month: month || (now.getMonth() + 1),
            year:  year  || now.getFullYear(),
        },
    })
    return response.data.data
}

/*
 * FUNCTION : get_analytics_category_activity
 * WHY      : Returns total income and expense by category for a given month.
 *            Used by CategoriesPage to show activity on cards regardless
 *            of whether it is an income or expense category.
 * @param   {number} month - 1–12 (default: current month)
 * @param   {number} year  - e.g. 2026 (default: current year)
 * @returns {Array} - [{ category_id, total_income, total_expense, total }]
 */
export async function get_analytics_category_activity(month, year) {
    const now = new Date()
    const response = await api.get('/analytics/categories/activity', {
        params: {
            month: month || (now.getMonth() + 1),
            year:  year  || now.getFullYear(),
        },
    })
    return response.data.data
}

/*
 * FUNCTION : get_analytics_daily
 * WHY      : Returns daily running balance for a date range.
 *            date_from/date_to default to the current month so
 *            callers can invoke it with no args and still get
 *            sensible data — avoids the server module-load time
 *            bug fixed in get_analytics_categories.
 * @param   {string} date_from - "YYYY-MM-DD" (default: 1st of current month)
 * @param   {string} date_to   - "YYYY-MM-DD" (default: last day of current month)
 * @returns {DailyBalance[]} - [{ date, balance }]
 */
export async function get_analytics_daily(date_from, date_to) {
    const now = new Date()
    const year  = now.getFullYear()
    const month = now.getMonth() + 1
    const pad   = n => String(n).padStart(2, '0')
    // Last day of the month: day 0 of the NEXT month = last day of this month
    const last_day = new Date(year, now.getMonth() + 1, 0).getDate()

    const from = date_from ?? `${year}-${pad(month)}-01`
    const to   = date_to   ?? `${year}-${pad(month)}-${pad(last_day)}`

    const response = await api.get('/analytics/daily', {
        params: { date_from: from, date_to: to },
    })
    return response.data.data
}