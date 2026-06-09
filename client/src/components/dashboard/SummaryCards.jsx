/*
 * ============================================================
 * FILE    : SummaryCards.jsx
 * LAYER   : View (dashboard component)
 * PURPOSE : Three stat cards showing total income, total expense,
 *           and net balance for the selected month.
 *           Card colors communicate financial health instantly
 *           before the user reads a single number.
 *
 * WHY COLORS SIGNAL HEALTH:
 *   A user glancing at the dashboard while running late should
 *   be able to read "all good" or "spending too much" from the
 *   card color alone. Green = positive, red = warning.
 *   This is standard financial dashboard UX (Mint, YNAB, etc.).
 *
 * DEPENDS : format_currency, react-router-dom (Link)
 * ============================================================
 * EXPORTS:
 *   - SummaryCards : 3-card financial summary grid
 * ============================================================
 */

import { Link } from 'react-router-dom'
import { format_currency } from '../../utils/format_currency'

// ── Skeleton ─────────────────────────────────────────────────
/*
 * COMPONENT : CardSkeleton
 * WHY       : Shows the card shape before data loads so the user
 *             understands the layout immediately, not after a blank
 *             wait. The pulse animation communicates "loading" without
 *             a spinner that obscures the entire area.
 */
function CardSkeleton() {
    return (
        <div className="bg-slate-50 rounded-xl shadow-sm p-6 border-l-4 border-slate-300 animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-24 bg-slate-300 rounded" />
                <div className="w-10 h-10 bg-slate-300 rounded-xl" />
            </div>
            <div className="h-8 w-32 bg-slate-300 rounded mb-2" />
            <div className="h-3 w-20 bg-slate-200 rounded" />
        </div>
    )
}

// ── Single card ───────────────────────────────────────────────
/*
 * COMPONENT : StatCard
 * WHY       : Extracted as its own component so the three cards
 *             in SummaryCards are declared with data, not with
 *             repeated JSX blocks. Each card is identical in
 *             structure; only colors and values differ.
 * @prop {string} label
 * @prop {string} amount_str   - raw string from backend e.g. "4500.00"
 * @prop {string} sublabel     - e.g. "May 2026" shown below amount
 * @prop {ReactNode} icon
 * @prop {string} border_color - Tailwind class e.g. "border-emerald-500"
 * @prop {string} icon_bg      - Tailwind class e.g. "bg-emerald-50"
 * @prop {string} icon_color   - Tailwind class e.g. "text-emerald-600"
 * @prop {string} amount_color - Tailwind class e.g. "text-emerald-600"
 */
function StatCard({ label, amount_str, sublabel, icon, border_color, icon_bg, icon_color, amount_color }) {
    return (
        <div className={`bg-slate-50 rounded-xl shadow-sm p-6 border-l-4 ${border_color}`}>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <div className={`w-10 h-10 ${icon_bg} rounded-xl flex items-center justify-center ${icon_color}`}>
                    {icon}
                </div>
            </div>
            <p className={`text-2xl font-bold ${amount_color}`}>
                {format_currency(amount_str)}
            </p>
            {sublabel && (
                <p className="text-xs text-slate-500 mt-1">{sublabel}</p>
            )}
        </div>
    )
}

// ── SVG icons ─────────────────────────────────────────────────
const IncomeIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
    </svg>
)
const ExpenseIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
    </svg>
)
const BalanceIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
)

/*
 * COMPONENT : SummaryCards
 * ─────────────────────────────────────────────────────────
 * WHY       : Answers "Am I earning more than I spend this month?"
 *             card color communicates the answer before reading numbers.
 * @prop {object|null} summary    - { total_income, total_expense,
 *                                    net_balance, record_count }
 * @prop {boolean}     is_loading
 * @prop {boolean}     has_error  - true if fetch failed
 * @prop {string}      month_label - "June 2026"
 * ─────────────────────────────────────────────────────────
 */
export default function SummaryCards({ summary, is_loading, has_error, month_label }) {

    // ── Loading state ─────────────────────────────────────
    if (is_loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
        )
    }

    // ── Error state ───────────────────────────────────────
    /*
     * WHY show error per-section not globally:
     *   If only the summary endpoint fails (network glitch),
     *   the charts and recent records can still render.
     *   A per-section error makes it obvious which API call
     *   failed without blanking the whole dashboard.
     */
    if (has_error || !summary) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-sm text-red-600 font-medium">Could not load summary for {month_label}.</p>
                <p className="text-xs text-red-400 mt-1">Check your connection and refresh the page.</p>
            </div>
        )
    }

    /*
     * WHY parseFloat only here:
     *   We need to check if net_balance is negative to decide
     *   the card color. parseFloat is display-logic only — we
     *   are not adding, subtracting, or storing the result.
     *   format_currency handles display formatting independently.
     */
    const is_net_positive = parseFloat(summary.net_balance ?? '0') >= 0

    const net_color = is_net_positive ? {
        border: 'border-indigo-500',
        icon_bg: 'bg-indigo-50',
        icon_color: 'text-indigo-600',
        amount: 'text-indigo-600',
    } : {
        border: 'border-red-500',
        icon_bg: 'bg-red-50',
        icon_color: 'text-red-600',
        amount: 'text-red-600',
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    label="Total Income"
                    amount_str={summary.total_income}
                    sublabel={month_label}
                    icon={IncomeIcon}
                    border_color="border-emerald-500"
                    icon_bg="bg-emerald-50"
                    icon_color="text-emerald-600"
                    amount_color="text-emerald-600"
                />
                <StatCard
                    label="Total Expense"
                    amount_str={summary.total_expense}
                    sublabel={month_label}
                    icon={ExpenseIcon}
                    border_color="border-red-500"
                    icon_bg="bg-red-50"
                    icon_color="text-red-600"
                    amount_color="text-red-600"
                />
                <StatCard
                    label="Net Balance"
                    amount_str={summary.net_balance}
                    sublabel={`${summary.record_count ?? 0} record${summary.record_count !== 1 ? 's' : ''}`}
                    icon={BalanceIcon}
                    border_color={net_color.border}
                    icon_bg={net_color.icon_bg}
                    icon_color={net_color.icon_color}
                    amount_color={net_color.amount}
                />
            </div>

            {/* ── Empty state footer ──────────────────────── */}
            {/*
             * WHY empty state not zero state:
             *   A new user sees $0.00 everywhere. Without this message
             *   that looks like broken data, not an empty account.
             *   Directing them to /records is the correct CTA.
             */}
            {summary.record_count === 0 && (
                <p className="text-sm text-slate-500 mt-3 text-center">
                    No records yet for {month_label}.{' '}
                    <Link to="/records" className="text-emerald-600 hover:underline font-medium">
                        Add your first record →
                    </Link>
                </p>
            )}
        </div>
    )
}
