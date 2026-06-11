/*
 * ============================================================
 * FILE    : components/ai/ExpensePlanner.jsx
 * LAYER   : View (component)
 * PURPOSE : Tab 1 of AiAssistantPage. Two sections on one screen:
 *           top — saved goals dashboard for the selected month;
 *           bottom — AI planner that generates and saves new goals.
 *           They belong together because the planner creates goals
 *           and the dashboard immediately shows them.
 * DEPENDS : BudgetGoalsDashboard, format_currency,
 *           api (ai_plan_expenses, save_budget_goals,
 *                get_budget_goals_for_planner, delete_budget_goal_by_id),
 *           utils/ai_error_helper, useToast
 * ============================================================
 * EXPORTS:
 *   - ExpensePlanner : full planner tab component
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react'
import BudgetGoalsDashboard from './BudgetGoalsDashboard'
import { format_currency } from '../../utils/format_currency'
import { handle_ai_error } from '../../utils/ai_error_helper'
import {
    ai_plan_expenses,
    save_budget_goals,
    get_budget_goals_for_planner,
    delete_budget_goal_by_id,
} from '../../services/api'
import { useToast } from '../layout/useToast'

// ── Month name helper ─────────────────────────────────────────
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

/*
 * FUNCTION : get_next_month_defaults
 * WHY      : The planner defaults to next month because planning
 *            for the current month mid-month is rarely useful.
 *            The backend policy also blocks past months, so defaulting
 *            to next month avoids an immediate validation error.
 * @returns {{ month: number, year: number }}
 */
function get_next_month_defaults() {
    const now = new Date()
    if (now.getMonth() === 11) {
        return { month: 1, year: now.getFullYear() + 1 }
    }
    return { month: now.getMonth() + 2, year: now.getFullYear() }
}

/*
 * COMPONENT : ExpensePlanner
 * ─────────────────────────────────────────────────────────
 * WHY      : See FILE PURPOSE above.
 *
 * HOW      : 1. On mount: load goals for the current view month
 *            2. User picks a plan month + enters target budget
 *            3. Generate → call ai_plan_expenses, store plan
 *            4. Render editable table (user adjusts amounts)
 *            5. Save → call save_budget_goals, reload dashboard
 *
 * @prop    {Function} on_request_complete() — tells parent to refresh usage
 * ─────────────────────────────────────────────────────────
 */
export default function ExpensePlanner({ on_request_complete }) {
    const now = new Date()
    const defaults = get_next_month_defaults()

    // ── View month (goals dashboard) ──────────────────────────
    const [view_month, setViewMonth] = useState(now.getMonth() + 1)
    const [view_year, setViewYear] = useState(now.getFullYear())

    // ── Goals state ───────────────────────────────────────────
    const [goals, setGoals] = useState([])
    const [goals_loading, setGoalsLoading] = useState(true)

    // ── Planner inputs ────────────────────────────────────────
    const [target_budget, setTargetBudget] = useState('')
    const [plan_month, setPlanMonth] = useState(defaults.month)
    const [plan_year, setPlanYear] = useState(defaults.year)

    // ── AI plan state ─────────────────────────────────────────
    const [ai_plan, setAiPlan] = useState(null)
    const [editable_plan, setEditablePlan] = useState([])
    const [is_generating, setIsGenerating] = useState(false)
    const [is_saving, setIsSaving] = useState(false)
    const [plan_error, setPlanError] = useState(null)

    const { show_toast } = useToast()

    /*
     * FUNCTION : load_goals
     * WHY      : Goals must reload when the view month changes and
     *            after save/delete operations. useCallback prevents
     *            unnecessary re-renders when passed to child props.
     */
    const load_goals = useCallback(async (month, year) => {
        setGoalsLoading(true)
        try {
            const data = await get_budget_goals_for_planner(month, year)
            setGoals(data)
        } catch {
            // Non-critical: show empty state rather than crashing
            setGoals([])
        } finally {
            setGoalsLoading(false)
        }
    }, [])

    // Reload whenever the dashboard month selector changes
    useEffect(() => {
        load_goals(view_month, view_year)
    }, [view_month, view_year, load_goals])

    /*
     * FUNCTION : handle_goal_deleted
     * WHY      : BudgetGoalsDashboard calls this when the user clicks ×.
     *            We do the delete here (not in the child) because the child
     *            is a pure display component — it should not own API calls.
     */
    const handle_goal_deleted = async (goal_id) => {
        const goal = goals.find(g => g.goal_id === goal_id)
        const name = goal?.category_name ?? goal?.category?.name ?? 'category'
        if (!window.confirm(`Remove ${name} from your budget plan?`)) return
        try {
            await delete_budget_goal_by_id(goal_id)
            show_toast(`Removed ${name} from budget.`, 'success')
            load_goals(view_month, view_year)
        } catch {
            show_toast('Failed to remove goal. Please try again.', 'error')
        }
    }

    /*
     * FUNCTION : handle_generate
     * WHY      : Calls the AI planner endpoint. On success the raw plan
     *            is stored in ai_plan and a parallel editable_plan array
     *            is created with a copy of suggested_amount as the user's
     *            starting value — they can then adjust before saving.
     */
    const handle_generate = async () => {
        // Client-side guard: strip non-numeric chars before sending
        const sanitised = target_budget.replace(/[^\d.]/g, '')
        if (!sanitised || isNaN(parseFloat(sanitised)) || parseFloat(sanitised) <= 0) {
            setPlanError('Please enter a valid budget amount (e.g. 2500).')
            return
        }

        setIsGenerating(true)
        setPlanError(null)
        setAiPlan(null)

        try {
            const plan = await ai_plan_expenses(sanitised, plan_month, plan_year)
            setAiPlan(plan)
            // WHY copy to editable_plan: ai_plan is the AI's original suggestion
            // (kept for reference); editable_plan tracks the user's adjustments.
            setEditablePlan(
                plan.map(item => ({
                    ...item,
                    editable_amount: item.suggested_amount,
                }))
            )
            show_toast('Budget plan generated.', 'success')
            on_request_complete()
        } catch (err) {
            handle_ai_error(err, setPlanError, show_toast)
        } finally {
            setIsGenerating(false)
        }
    }

    /*
     * FUNCTION : handle_save
     * WHY      : Writes the user-adjusted plan to the BudgetGoal table.
     *            replace=true clears any old goals for this month first so
     *            stale categories from a previous planning session don't
     *            persist alongside the new set.
     */
    const handle_save = async () => {
        const goals_payload = editable_plan.map(item => ({
            category_id: item.category_id,
            amount: item.editable_amount.toString().replace(/[^\d.]/g, ''),
        }))

        setIsSaving(true)
        try {
            await save_budget_goals(goals_payload, plan_month, plan_year, true)
            show_toast('Budget goals saved.', 'success')
            setAiPlan(null)
            setEditablePlan([])
            // Switch the dashboard view to show the just-saved month
            setViewMonth(plan_month)
            setViewYear(plan_year)
            load_goals(plan_month, plan_year)
        } catch (err) {
            handle_ai_error(err, setPlanError, show_toast)
        } finally {
            setIsSaving(false)
        }
    }

    /*
     * WHY block save for past months:
     *   The backend policy blocks it anyway, but attempting the call
     *   wastes an AI request count (the plan was already generated).
     *   Disabling the button gives earlier feedback.
     */
    const is_past_month =
        plan_year < now.getFullYear() ||
        (plan_year === now.getFullYear() && plan_month <= now.getMonth() + 1)

    // Year options for the plan selector (current + next)
    const plan_year_options = [now.getFullYear(), now.getFullYear() + 1]

    // ── Editable plan row total ───────────────────────────────
    const plan_total = editable_plan.reduce(
        (sum, item) => sum + parseFloat(item.editable_amount || 0), 0
    )
    const target_num = parseFloat(target_budget.replace(/[^\d.]/g, '') || 0)

    const month_label =
        `${MONTH_NAMES[view_month - 1]} ${view_year}`

    return (
        <div className="space-y-8">

            {/* ════════════════════════════════════════════════
                SECTION 1 — Goals Dashboard
            ════════════════════════════════════════════════ */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-base font-semibold text-slate-900">
                        Budget Tracker
                    </h2>

                    {/* Month selector for the dashboard view */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Viewing:</label>
                        <select
                            value={view_month}
                            onChange={e => setViewMonth(Number(e.target.value))}
                            className="bg-slate-200 border border-slate-400 text-slate-700
                                       text-sm rounded-lg px-2 py-1.5 focus:ring-2
                                       focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {MONTH_NAMES.map((name, idx) => (
                                <option key={name} value={idx + 1}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={view_year}
                            onChange={e => setViewYear(Number(e.target.value))}
                            className="bg-slate-200 border border-slate-400 text-slate-700
                                       text-sm rounded-lg px-2 py-1.5 focus:ring-2
                                       focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {[now.getFullYear(), now.getFullYear() + 1].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <BudgetGoalsDashboard
                    goals={goals}
                    month_label={month_label}
                    is_loading={goals_loading}
                    on_goal_deleted={handle_goal_deleted}
                />
            </section>

            {/* ── Divider ── */}
            <div className="border-t border-slate-400/60" />

            {/* ════════════════════════════════════════════════
                SECTION 2 — AI Planner
            ════════════════════════════════════════════════ */}
            <section>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                    Generate a Budget Plan with AI
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    Gemini analyses your past spending and suggests how to
                    allocate a monthly budget. You can edit the amounts before saving.
                </p>

                {/* ── Planner controls ── */}
                <div className="flex flex-wrap gap-3 items-end mb-4">

                    {/* Plan-for month/year */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Plan for</label>
                        <div className="flex gap-2">
                            <select
                                value={plan_month}
                                onChange={e => setPlanMonth(Number(e.target.value))}
                                className="bg-slate-200 border border-slate-400 text-slate-700
                                           text-sm rounded-lg px-2 py-2 focus:ring-2
                                           focus:ring-indigo-500"
                            >
                                {MONTH_NAMES.map((name, idx) => (
                                    <option key={name} value={idx + 1}>{name}</option>
                                ))}
                            </select>
                            <select
                                value={plan_year}
                                onChange={e => setPlanYear(Number(e.target.value))}
                                className="bg-slate-200 border border-slate-400 text-slate-700
                                           text-sm rounded-lg px-2 py-2 focus:ring-2
                                           focus:ring-indigo-500"
                            >
                                {plan_year_options.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Target budget input */}
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-xs text-slate-500 mb-1">
                            Target budget
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                                $
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={target_budget}
                                onChange={e => setTargetBudget(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !is_generating && handle_generate()}
                                placeholder="e.g. 2500"
                                className="w-full bg-slate-200 border border-slate-400 text-slate-900
                                           rounded-lg pl-7 pr-4 py-2 text-sm
                                           focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                                           placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Generate button */}
                    <button
                        onClick={handle_generate}
                        disabled={is_generating || !target_budget}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600
                                   hover:bg-indigo-500 text-white text-sm font-medium
                                   rounded-lg transition-colors disabled:opacity-50
                                   disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {is_generating ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Asking Gemini...
                            </>
                        ) : (
                            <>✨ Generate Plan</>
                        )}
                    </button>
                </div>

                {/* ── Error banner ── */}
                {plan_error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40
                                    rounded-lg text-sm text-red-400">
                        {plan_error}
                    </div>
                )}

                {/* ── Skeleton table while generating ── */}
                {is_generating && (
                    <div className="animate-pulse space-y-2 mt-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="flex gap-4 items-center py-3 border-b border-slate-300">
                                <div className="h-4 w-32 bg-slate-300 rounded" />
                                <div className="h-4 w-20 bg-slate-300 rounded" />
                                <div className="h-8 w-24 bg-slate-300 rounded" />
                                <div className="h-4 w-12 bg-slate-300 rounded" />
                                <div className="h-4 flex-1 bg-slate-200 rounded" />
                            </div>
                        ))}
                    </div>
                )}

                {/* ── AI response table ── */}
                {ai_plan && !is_generating && (
                    <div className="mt-2">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-slate-600">
                                AI Budget Suggestion for{' '}
                                {MONTH_NAMES[plan_month - 1]} {plan_year}
                            </h3>
                            <span className="text-xs text-slate-500 italic">
                                You can edit the amounts below before saving.
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-400">
                                        <th className="text-left text-xs text-slate-500 font-medium py-2 pr-4">
                                            Category
                                        </th>
                                        <th className="text-right text-xs text-slate-500 font-medium py-2 px-4">
                                            AI Suggested
                                        </th>
                                        <th className="text-right text-xs text-slate-500 font-medium py-2 px-4">
                                            Your Amount
                                        </th>
                                        <th className="text-right text-xs text-slate-500 font-medium py-2 pl-4">
                                            %
                                        </th>
                                        <th className="text-left text-xs text-slate-500 font-medium py-2 pl-6">
                                            Reason
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editable_plan.map((item, idx) => {
                                        /*
                                         * WHY show percentage of target_num:
                                         *   Users need to see how their adjusted amount
                                         *   compares to the total budget, not to AI's
                                         *   suggestion. Re-compute on each render so
                                         *   it updates live as they type.
                                         */
                                        const pct = target_num > 0
                                            ? ((parseFloat(item.editable_amount || 0) / target_num) * 100).toFixed(1)
                                            : item.percentage

                                        return (
                                            <tr key={item.category_id ?? idx}
                                                className="border-b border-slate-300/60
                                                           hover:bg-slate-300/30 transition-colors">
                                                <td className="py-3 pr-4 text-slate-900 font-medium">
                                                    {item.category_name}
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-500">
                                                    {format_currency(item.suggested_amount)}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="relative inline-block">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2
                                                                         text-slate-500 text-xs">$</span>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={item.editable_amount}
                                                            onChange={e => {
                                                                const updated = [...editable_plan]
                                                                updated[idx] = {
                                                                    ...updated[idx],
                                                                    editable_amount: e.target.value,
                                                                }
                                                                setEditablePlan(updated)
                                                            }}
                                                            className="w-24 bg-slate-200 border border-slate-600
                                                                       rounded pl-5 pr-2 py-1 text-right text-slate-900
                                                                       text-sm focus:ring-1 focus:ring-indigo-500
                                                                       focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-3 pl-4 text-right text-slate-600">
                                                    {pct}%
                                                </td>
                                                <td className="py-3 pl-6 text-slate-500 text-xs max-w-[200px]">
                                                    {item.reason}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                {/* Table footer — running total */}
                                <tfoot>
                                    <tr className="border-t-2 border-slate-400 bg-slate-50">
                                        <td className="py-4 pr-4 text-base text-slate-800 font-bold">
                                            Total
                                        </td>
                                        <td className="py-4 px-4 text-right text-base text-slate-700 font-semibold">
                                            {format_currency(
                                                ai_plan.reduce((s, i) =>
                                                    s + parseFloat(i.suggested_amount || 0), 0
                                                ).toFixed(2)
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <span className={`text-lg font-bold ${
                                                Math.abs(plan_total - target_num) < 0.01
                                                    ? 'text-emerald-700'
                                                    : plan_total > target_num
                                                        ? 'text-red-600'
                                                        : 'text-amber-700'
                                            }`}>
                                                {format_currency(plan_total.toFixed(2))}
                                            </span>
                                        </td>
                                        <td colSpan={2} className="py-4 pl-4 text-sm font-semibold text-slate-700">
                                            {plan_total > target_num
                                                ? `${format_currency((plan_total - target_num).toFixed(2))} over budget`
                                                : plan_total < target_num
                                                    ? `${format_currency((target_num - plan_total).toFixed(2))} unallocated`
                                                    : 'Perfectly allocated ✓'
                                            }
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Save button */}
                        <div className="flex justify-end mt-4 gap-3">
                            <button
                                onClick={() => { setAiPlan(null); setEditablePlan([]) }}
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900
                                           hover:bg-slate-300 rounded-lg transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handle_save}
                                disabled={is_saving || is_past_month}
                                title={is_past_month ? 'Cannot save goals for a past month' : ''}
                                className="flex items-center gap-2 px-5 py-2 bg-emerald-600
                                           hover:bg-emerald-500 text-white text-sm font-medium
                                           rounded-lg transition-colors disabled:opacity-50
                                           disabled:cursor-not-allowed"
                            >
                                {is_saving ? 'Saving...' : '💾 Save as Goals'}
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}