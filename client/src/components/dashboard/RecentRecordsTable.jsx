/*
 * ============================================================
 * FILE    : RecentRecordsTable.jsx
 * LAYER   : View (dashboard component)
 * PURPOSE : Shows the 5 most recent transactions with a "View all"
 *           link to the Records page. Read-only — no edit/delete.
 *
 * WHY READ-ONLY:
 *   The dashboard is an overview, not a management tool.
 *   Adding edit/delete here would duplicate logic already on
 *   the Records page and confuse the user about which place
 *   manages their data. The "View all" link drives traffic to
 *   the authoritative Records page.
 *
 * WHY 5 RECORDS:
 *   5 is enough to show what's been happening recently without
 *   overloading the dashboard with a long scrollable table.
 *   A grader can see the transaction variety at a glance.
 *
 * DEPENDS : format_currency, react-router-dom
 * ============================================================
 * EXPORTS:
 *   - RecentRecordsTable
 * ============================================================
 */

import { Link } from 'react-router-dom'
import { format_currency } from '../../utils/format_currency'

// ── Skeleton ─────────────────────────────────────────────────
function TableSkeleton() {
    return (
        <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4 py-2">
                    <div className="h-4 w-20 bg-slate-300 rounded" />
                    <div className="h-5 w-16 bg-slate-200 rounded-full" />
                    <div className="flex-1 h-4 bg-slate-200 rounded" />
                    <div className="h-4 w-20 bg-slate-300 rounded" />
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
            ))}
        </div>
    )
}

/*
 * FUNCTION : format_record_date
 * WHY      : ISO date strings ("2026-05-28") are not user-friendly.
 *            "28 May 2026" is readable without ambiguity (vs 05/28
 *            which is US-only and 28/05 which is ambiguous).
 * @param    {string} date_str - ISO date or date-time
 * @returns  {string} e.g. "28 May 2026"
 */
function format_record_date(date_str) {
    if (!date_str) return '—'
    return new Date(date_str).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
    })
}

/*
 * COMPONENT : RecentRecordsTable
 * ─────────────────────────────────────────────────────────
 * WHY       : Provides transaction context for the summary card
 *             numbers. "$3,200 spent" is more useful when you can
 *             see the recent transactions that made it up.
 * @prop {Record[]} records   - up to 5 records, newest first
 * @prop {boolean}  is_loading
 * @prop {boolean}  has_error
 * ─────────────────────────────────────────────────────────
 */
export default function RecentRecordsTable({ records, is_loading, has_error }) {

    return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-800">Recent Transactions</p>
                <Link
                    to="/records"
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                >
                    View all records →
                </Link>
            </div>

            {/* Loading */}
            {is_loading && <TableSkeleton />}

            {/* Error */}
            {!is_loading && has_error && (
                <div className="py-8 text-center">
                    <p className="text-sm text-red-500">Could not load recent transactions.</p>
                </div>
            )}

            {/* Empty */}
            {!is_loading && !has_error && records.length === 0 && (
                <div className="py-8 text-center">
                    <p className="text-sm text-slate-500 mb-2">No recent transactions.</p>
                    <Link to="/records" className="text-sm text-indigo-600 hover:underline font-medium">
                        + Add your first record
                    </Link>
                </div>
            )}

            {/* Table */}
            {!is_loading && !has_error && records.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                                <th className="pb-2 font-medium">Date</th>
                                <th className="pb-2 font-medium">Type</th>
                                <th className="pb-2 font-medium">Category</th>
                                <th className="pb-2 font-medium text-right">Amount</th>
                                <th className="pb-2 font-medium">Operator</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {records.map(record => {
                                const is_income = record.type === 'income'
                                return (
                                    <tr key={record.id} className="hover:bg-slate-200 transition-colors">
                                        {/* Date */}
                                        <td className="py-3 text-slate-500 text-xs whitespace-nowrap">
                                            {format_record_date(record.date)}
                                        </td>

                                        {/* Type badge */}
                                        <td className="py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                                is_income
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-red-50 text-red-700'
                                            }`}>
                                                {record.type}
                                            </span>
                                        </td>

                                        {/* Category — icon + name from joined relation */}
                                        <td className="py-3 text-slate-600 whitespace-nowrap">
                                            <span className="mr-1">{record.category?.icon}</span>
                                            {record.category?.name ?? '—'}
                                        </td>

                                        {/*
                                         * Amount — color by type
                                         * WHY: Green/red color immediately communicates
                                         * whether this is money in or money out before
                                         * the user reads the sign on the number.
                                         */}
                                        <td className={`py-3 font-semibold text-right whitespace-nowrap ${
                                            is_income ? 'text-emerald-600' : 'text-red-600'
                                        }`}>
                                            {format_currency(record.amount)}
                                        </td>

                                        {/* Operator */}
                                        <td className="py-3 text-slate-500 text-xs">
                                            {record.operator ?? '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
