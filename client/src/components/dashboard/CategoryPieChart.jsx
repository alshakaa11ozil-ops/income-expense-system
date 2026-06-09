/*
 * ============================================================
 * FILE    : CategoryPieChart.jsx
 * LAYER   : View (dashboard component)
 * PURPOSE : Donut chart showing expense breakdown by category.
 *           Slice colors come from category.color in the DB so
 *           they are consistent with badges on the Records page.
 *
 * WHY A DONUT NOT A FULL PIE:
 *   A donut (pie with innerRadius) is more modern and allows
 *   a total amount to be rendered in the center hole in future.
 *   It also differentiates visually from generic pie charts.
 *
 * WHY CUSTOM LEGEND:
 *   Recharts' built-in <Legend /> only shows color dot + name.
 *   We want to show name + formatted amount + percentage side
 *   by side, making it a readable breakdown table, not just
 *   a color key.
 *
 * DEPENDS : recharts, format_currency
 * ============================================================
 * EXPORTS:
 *   - CategoryPieChart
 * ============================================================
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { format_currency } from '../../utils/format_currency'

function ChartSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-5 w-44 bg-slate-300 rounded mb-1" />
            <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
            <div className="h-64 bg-slate-200 rounded-full mx-auto w-64" />
            <div className="mt-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-4 bg-slate-200 rounded" />)}
            </div>
        </div>
    )
}

/*
 * COMPONENT : CategoryPieChart
 * ─────────────────────────────────────────────────────────
 * WHY       : "Where does my money go?" answered visually.
 *             Category colors match the Records page badges
 *             because both use the same DB color field.
 * @prop {CategoryBreakdown[]} categories
 * @prop {boolean}             is_loading
 * @prop {boolean}             has_error
 * @prop {string}              month_label - "June 2026"
 * ─────────────────────────────────────────────────────────
 */
export default function CategoryPieChart({ categories, is_loading, has_error, month_label }) {

    if (is_loading) return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6">
            <ChartSkeleton />
        </div>
    )

    if (has_error) return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6">
            <p className="text-sm font-semibold text-slate-800 mb-1">Spending by Category</p>
            <div className="h-64 flex items-center justify-center">
                <p className="text-sm text-red-500">Could not load category data.</p>
            </div>
        </div>
    )

    const is_empty = !categories || categories.length === 0

    /*
     * WHY parseFloat here:
     *   Recharts Pie requires numeric values to size each slice.
     *   Display-only — same acceptable exception as the line chart.
     *   We keep total_str separately for formatted display.
     */
    const chart_data = (categories ?? []).map(cat => ({
        name:       `${cat.icon} ${cat.category_name}`,
        value:      parseFloat(cat.total),
        color:      cat.color,
        percentage: cat.percentage,  // "25.00" string — display in legend
        total_str:  cat.total,       // "800.00" string — formatted in legend
    }))

    // Show max 8 slices — "and N more" for the rest
    const visible = chart_data.slice(0, 8)
    const overflow_count = chart_data.length - visible.length

    return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6">
            {/* Card header */}
            <div className="mb-4">
                <p className="text-sm font-semibold text-slate-800">Spending by Category</p>
                <p className="text-xs text-slate-500">{month_label} — expenses only</p>
            </div>

            {is_empty ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-center">
                    <span className="text-4xl">🥧</span>
                    <p className="text-sm font-medium text-slate-600">No expense data yet</p>
                    <p className="text-xs text-slate-500 max-w-xs">
                        Add some expense records to see your spending breakdown by category.
                    </p>
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={visible}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={100}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {visible.map((entry, i) => (
                                    /*
                                     * WHY Cell not stroke:
                                     *   Each Cell overrides the default fill with
                                     *   the category's own color from the DB.
                                     *   This ensures pie colors and badge colors
                                     *   are always identical across the app.
                                     */
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(_, __, props) => [
                                    format_currency(props.payload.total_str),
                                    props.payload.name,
                                ]}
                                contentStyle={{
                                    borderRadius: '10px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>

                    {/*
                     * CUSTOM LEGEND
                     * WHY: Recharts default Legend is just a color dot + name.
                     *   We want to show amount and percentage so this functions
                     *   as a readable breakdown table, not just a color key.
                     */}
                    <div className="mt-3 space-y-2">
                        {visible.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                {/* color dot */}
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: item.color }}
                                />
                                {/* category name — takes available space */}
                                <span className="flex-1 text-slate-600 truncate">{item.name}</span>
                                {/* formatted amount */}
                                <span className="font-medium text-slate-700">
                                    {format_currency(item.total_str)}
                                </span>
                                {/* percentage badge */}
                                <span className="text-slate-500 w-12 text-right">
                                    {parseFloat(item.percentage).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                        {overflow_count > 0 && (
                            <p className="text-xs text-slate-500 pt-1">
                                …and {overflow_count} more {overflow_count === 1 ? 'category' : 'categories'}
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
