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
export async function get_analytics_summary(month, year) {
    const response = await api.get('/analytics/summary', {
        params: { month, year },
    })
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
 *            on the Dashboard. Chat 9 uses this.
 * @returns {MonthlyTrend[]} - [{ month, income, expense }]
 */
export async function get_analytics_trends() {
    const response = await api.get('/analytics/trends')
    return response.data.data
}

/*
 * FUNCTION : get_analytics_categories
 * WHY      : Returns spending by category for the pie chart on
 *            the Dashboard. Chat 9 uses this.
 * @returns {CategoryStat[]} - [{ category, total, count }]
 */
export async function get_analytics_categories() {
    const response = await api.get('/analytics/categories')
    return response.data.data
}

/*
 * FUNCTION : get_analytics_daily
 * WHY      : Returns daily running balance for the daily chart.
 *            Chat 9 may use this.
 * @returns {DailyBalance[]} - [{ date, balance }]
 */
export async function get_analytics_daily() {
    const response = await api.get('/analytics/daily')
    return response.data.data
}