/*
 * ============================================================
 * FILE    : IncomeExpenseLineChart.jsx
 * LAYER   : View (dashboard component)
 * PURPOSE : Line chart showing income vs expense over the last
 *           N months (default 6). Two lines reveal the trend
 *           relationship between earning and spending over time.
 *
 * WHY A LINE CHART NOT A BAR CHART:
 *   Bar charts are good for comparing discrete categories.
 *   A line chart emphasises trend and direction — the user can
 *   see at a glance whether the gap between income and expense
 *   is widening or closing over months. That directional story
 *   is the primary value of this chart.
 *
 * WHY parseFloat IS ACCEPTABLE HERE:
 *   Recharts requires Number values to plot lines. This is the
 *   one intentional exception to the "no parseFloat on amounts"
 *   rule — the values are plotted, never used for arithmetic.
 *   They are immediately discarded after rendering.
 *
 * DEPENDS : recharts, format_currency
 * ============================================================
 * EXPORTS:
 *   - IncomeExpenseLineChart
 * ============================================================
 */

import {
    LineChart, Line, XAxis, YAxis, Tooltip, Legend,
    CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { format_currency } from '../../utils/format_currency'

// ── Skeleton ─────────────────────────────────────────────────
function ChartSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-5 w-40 bg-slate-300 rounded mb-1" />
            <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
            <div className="h-72 bg-slate-200 rounded-lg" />
        </div>
    )
}

/*
 * COMPONENT : IncomeExpenseLineChart
 * ─────────────────────────────────────────────────────────
 * WHY       : A single month (summary cards) shows where you ARE.
 *             Six months shows where you are GOING. This chart
 *             reveals patterns invisible from a single snapshot.
 * @prop {MonthlyTrend[]} trends     - backend response array
 * @prop {boolean}        is_loading
 * @prop {boolean}        has_error
 * ─────────────────────────────────────────────────────────
 */
export default function IncomeExpenseLineChart({ trends, is_loading, has_error }) {

    if (is_loading) return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6">
            <ChartSkeleton />
        </div>
    )

    if (has_error) return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6">
            <p className="text-sm font-semibold text-slate-800 mb-1">Income vs Expense</p>
            <div className="h-72 flex items-center justify-center">
                <p className="text-sm text-red-500">Could not load trend data.</p>
            </div>
        </div>
    )

    /*
     * WHY check all-zero not array length:
     *   The backend always returns 6 items even for empty accounts.
     *   An all-zeros dataset would render a flat line at the bottom
     *   which looks like a broken chart. The empty state message
     *   is more informative for new users.
     */
    const all_zero = trends.length === 0 || trends.every(
        t => t.income === '0.00' && t.expense === '0.00'
    )

    /*
     * WHY transform to numbers before Recharts:
     *   Backend sends strings ("1500.00"). Recharts cannot plot
     *   strings — it would render nothing or NaN. parseFloat is
     *   acceptable here because we are mapping to chart coordinates,
     *   not performing financial arithmetic.
     */
    const chart_data = trends.map(item => ({
        month:   item.label,               // "May 2026" — X axis label
        income:  parseFloat(item.income),  // number for line plotting
        expense: parseFloat(item.expense),
    }))

    return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6">
            {/* Card header */}
            <div className="mb-4">
                <p className="text-sm font-semibold text-slate-800">Income vs Expense</p>
                <p className="text-xs text-slate-500">Last {trends.length} months</p>
            </div>

            {all_zero ? (
                <div className="h-72 flex flex-col items-center justify-center gap-2 text-center">
                    <span className="text-4xl">📈</span>
                    <p className="text-sm font-medium text-slate-600">No trend data yet</p>
                    <p className="text-xs text-slate-500 max-w-xs">
                        Your income and expense chart will appear here after
                        you add records across multiple months.
                    </p>
                </div>
            ) : (
                /*
                 * WHY ResponsiveContainer:
                 *   Without it, the chart has a fixed pixel width and
                 *   breaks on mobile or when the sidebar is open/closed.
                 *   ResponsiveContainer reads its parent's CSS width and
                 *   resizes the SVG automatically on every window resize.
                 */
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chart_data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tickFormatter={v => `$${v.toLocaleString()}`}
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            tickLine={false}
                            axisLine={false}
                            width={72}
                        />
                        {/*
                         * WHY custom Tooltip formatter:
                         *   Recharts' default tooltip shows raw numbers
                         *   like "1500". We want "$1,500.00" consistent
                         *   with every other amount on the page.
                         *   String(value) converts the number back to a
                         *   string so format_currency can process it.
                         */}
                        <Tooltip
                            formatter={(value) => [format_currency(String(value)), '']}
                            labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                            contentStyle={{
                                borderRadius: '10px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                            }}
                        />
                        <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="income"
                            name="Income"
                            stroke="#10B981"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="expense"
                            name="Expense"
                            stroke="#EF4444"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    )
}
