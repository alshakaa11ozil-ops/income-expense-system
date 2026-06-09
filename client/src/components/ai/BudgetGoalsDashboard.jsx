/*
 * ============================================================
 * FILE    : components/ai/BudgetGoalsDashboard.jsx
 * LAYER   : View (component)
 * PURPOSE : Renders the persistent output of an AI planning session
 *           as progress bars showing planned vs actual spending per
 *           category. Lives at the top of the Budget Planner tab.
 * DEPENDS : utils/format_currency, utils/ai_error_helper (unused here),
 *           api (delete_budget_goal_by_id via prop callback)
 * ============================================================
 * EXPORTS:
 *   - BudgetGoalsDashboard : list of enriched goal progress rows
 * ============================================================
 */

import React from 'react'
import { format_currency } from '../../utils/format_currency'

/*
 * COMPONENT : BudgetGoalsDashboard
 * ─────────────────────────────────────────────────────────
 * WHY      : After the user saves an AI-generated budget plan,
 *            they need a persistent view that shows how their
 *            actual spending tracks against each goal. Progress
 *            bars make over/under budget status instantly visible
 *            without reading raw numbers.
 *
 * HOW      : 1. Loading state: 3 skeleton rows
 *            2. Empty state: prompt pointing to planner below
 *            3. Goal rows: progress bar + amounts + over-budget alert
 *            4. Footer: total planned vs total spent
 *
 * @prop    {EnrichedGoal[]} goals         - from get_budget_goals_for_planner
 * @prop    {string}         month_label   - e.g. "June 2026"
 * @prop    {boolean}        is_loading
 * @prop    {Function}       on_goal_deleted(goal_id) - parent refreshes goals
 * ─────────────────────────────────────────────────────────
 */
export default function BudgetGoalsDashboard({
    goals,
    month_label,
    is_loading,
    on_goal_deleted,
}) {

    // ── Loading skeletons ─────────────────────────────────────
    if (is_loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                        <div className="flex justify-between mb-2">
                            <div className="h-4 w-32 bg-slate-300 rounded" />
                            <div className="h-4 w-20 bg-slate-300 rounded" />
                        </div>
                        <div className="h-2.5 w-full bg-slate-300 rounded-full" />
                        <div className="h-3 w-40 bg-slate-200 rounded mt-1.5" />
                    </div>
                ))}
            </div>
        )
    }

    // ── Empty state ───────────────────────────────────────────
    if (!goals || goals.length === 0) {
        return (
            <div className="text-center py-10 border border-dashed border-slate-400 rounded-xl bg-slate-200/20">
                <div className="text-3xl mb-3">📊</div>
                <p className="text-slate-900 font-medium mb-1">
                    No budget set for {month_label} yet.
                </p>
                <p className="text-slate-500 text-sm max-w-xs mx-auto mb-4">
                    Use the AI Planner below to generate a budget plan,
                    then save it to track your spending here.
                </p>
                {/* Arrow pointing at the planner section below */}
                <div className="flex justify-center">
                    <svg
                        className="w-5 h-5 text-indigo-400 animate-bounce"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round"
                            strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        )
    }

    /*
     * WHY compute totals here and not in the parent:
     *   The summary footer is specific to this component's display.
     *   Keeping the math here avoids prop-drilling computed values.
     *   parseFloat is safe here — display only, no financial arithmetic.
     */
    const total_planned = goals.reduce(
        (sum, g) => sum + parseFloat(g.goal_amount ?? 0), 0
    )
    const total_spent = goals.reduce(
        (sum, g) => sum + parseFloat(g.spent ?? 0), 0
    )

    /*
     * FUNCTION : get_bar_colour
     * WHY      : Visual traffic-light system makes over/under budget
     *            immediately obvious without reading numbers.
     *            Three thresholds match the spec exactly.
     */
    const get_bar_colour = (percentage) => {
        const pct = parseFloat(percentage)
        if (pct > 100) return 'bg-red-500'
        if (pct > 75) return 'bg-amber-500'
        return 'bg-emerald-500'
    }

    return (
        <div className="space-y-5">

            {/* ── Goal rows ── */}
            {goals.map(goal => {
                /*
                 * WHY cap bar width at 100%:
                 *   Overflow breaks the container layout — the bar would
                 *   escape its rounded parent. The text already shows the
                 *   real over-budget amount below, so visual capping is safe.
                 */
                const bar_width = Math.min(parseFloat(goal.percentage ?? 0), 100)
                const bar_colour = get_bar_colour(goal.percentage)

                const over_amount = goal.is_over_budget
                    ? (parseFloat(goal.spent) - parseFloat(goal.goal_amount)).toFixed(2)
                    : null

                return (
                    <div key={goal.goal_id} className="group">

                        {/* Row header */}
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                {/* Category icon circle */}
                                <span
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                                    style={{ backgroundColor: `${goal.color}25` }}
                                >
                                    {goal.icon}
                                </span>
                                <span className="text-sm font-medium text-slate-900">
                                    {goal.category_name}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-500">
                                    {format_currency(goal.goal_amount)} target
                                </span>

                                {/* Delete button — only visible on hover */}
                                <button
                                    onClick={() => on_goal_deleted(goal.goal_id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity
                                               text-slate-500 hover:text-red-400 text-lg leading-none
                                               w-5 h-5 flex items-center justify-center"
                                    title={`Remove ${goal.category_name} from budget`}
                                    aria-label={`Remove ${goal.category_name} from budget`}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2.5 w-full bg-slate-300/60 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${bar_colour}`}
                                style={{ width: `${bar_width}%` }}
                            />
                        </div>

                        {/* Amounts row */}
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-slate-500">
                                {format_currency(goal.spent)} spent of {format_currency(goal.goal_amount)}
                            </span>

                            {/* Over-budget callout */}
                            {goal.is_over_budget && over_amount && (
                                <span className="text-xs text-red-400 font-medium">
                                    Over budget by {format_currency(over_amount)}
                                </span>
                            )}
                        </div>

                    </div>
                )
            })}

            {/* ── Summary footer ── */}
            <div className="pt-4 border-t border-slate-400/50 flex justify-between text-sm">
                <div>
                    <span className="text-slate-500">Total planned: </span>
                    <span className="text-slate-900 font-medium">
                        {format_currency(total_planned.toFixed(2))}
                    </span>
                </div>
                <div>
                    <span className="text-slate-500">Total spent: </span>
                    <span
                        className={`font-medium ${total_spent > total_planned ? 'text-red-400' : 'text-emerald-400'
                            }`}
                    >
                        {format_currency(total_spent.toFixed(2))}
                    </span>
                </div>
            </div>

        </div>
    )
}