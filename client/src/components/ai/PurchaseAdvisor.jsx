/*
 * ============================================================
 * FILE    : components/ai/PurchaseAdvisor.jsx
 * LAYER   : View (component)
 * PURPOSE : Tab 2 of AiAssistantPage. User enters an item, cost,
 *           and planned date; Gemini returns a structured verdict.
 *           The enum verdict drives deterministic UI rendering —
 *           no natural language parsing required on the frontend.
 * DEPENDS : format_currency, ai_advise_purchase (api),
 *           utils/ai_error_helper
 * ============================================================
 * EXPORTS:
 *   - PurchaseAdvisor : purchase affordability advisor tab
 * ============================================================
 */

import React, { useState } from 'react'
import { format_currency } from '../../utils/format_currency'
import { handle_ai_error } from '../../utils/ai_error_helper'
import { ai_advise_purchase } from '../../services/api'

/*
 * COMPONENT : PurchaseAdvisor
 * ─────────────────────────────────────────────────────────
 * WHY      : Point-in-time purchase decisions benefit from an
 *            objective view of the user's current finances.
 *            The backend injects income, expenses, and balance
 *            context before forwarding to Gemini, so the user
 *            only needs to describe the item.
 *
 * HOW      : 1. User fills form (item, cost, date)
 *            2. Submit → ai_advise_purchase → structured verdict
 *            3. Render verdict card with colour coding
 *            4. "Ask about another" resets to form
 *
 * @prop    {Function} on_request_complete() — parent refreshes usage counter
 * ─────────────────────────────────────────────────────────
 */
export default function PurchaseAdvisor({ on_request_complete }) {
    const [item_name, setItemName] = useState('')
    const [item_cost, setItemCost] = useState('')
    const [planned_date, setPlannedDate] = useState('')
    const [result, setResult] = useState(null)
    const [is_loading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    /*
     * FUNCTION : handle_submit
     * WHY      : Sanitises cost before sending to avoid 400 errors
     *            when the user types "$1,200" instead of "1200".
     *            All three fields are required — the backend validates
     *            too, but client validation gives faster feedback.
     */
    const handle_submit = async () => {
        const sanitised_cost = item_cost.replace(/[^\d.]/g, '')

        if (!item_name.trim()) { setError('Please enter an item name.'); return }
        if (!sanitised_cost || isNaN(parseFloat(sanitised_cost)) || parseFloat(sanitised_cost) <= 0) {
            setError('Please enter a valid cost (e.g. 1200).')
            return
        }
        if (!planned_date) { setError('Please select a planned purchase date.'); return }

        setIsLoading(true)
        setResult(null)
        setError(null)

        try {
            const data = await ai_advise_purchase(
                item_name.trim(),
                sanitised_cost,
                planned_date,
            )
            setResult(data)
            on_request_complete()
        } catch (err) {
            handle_ai_error(err, setError)
        } finally {
            setIsLoading(false)
        }
    }

    // ── Verdict config — determines badge colours and icons ───
    const VERDICT_CONFIG = {
        can_afford: {
            bg: 'bg-emerald-500/15 border-emerald-500/30',
            text: 'text-emerald-400',
            icon: '✓',
            label: 'You can afford this',
        },
        wait: {
            bg: 'bg-amber-500/15 border-amber-500/30',
            text: 'text-amber-400',
            icon: '⏳',
            label: 'Consider saving up first',
        },
        adjust_spending: {
            bg: 'bg-red-500/15 border-red-500/30',
            text: 'text-red-400',
            icon: '⚠️',
            label: 'Review your spending first',
        },
    }

    // ─────────────────────────────────────────────────────────
    // RESULT CARD
    // ─────────────────────────────────────────────────────────
    if (result) {
        const cfg = VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.wait

        return (
            <div className="max-w-xl mx-auto space-y-5">

                {/* Verdict badge */}
                <div className={`p-5 rounded-xl border ${cfg.bg}`}>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-2xl">{cfg.icon}</span>
                        <span className={`text-lg font-semibold ${cfg.text}`}>
                            {cfg.label}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        {item_name} · {format_currency(
                            item_cost.replace(/[^\d.]/g, '')
                        )}
                    </p>
                </div>

                {/* Reasoning */}
                <div className="bg-slate-200/50 rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase
                                   tracking-wider mb-3">
                        Gemini's reasoning
                    </h3>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                        {result.reasoning}
                    </p>
                </div>

                {/* Wait — months to save */}
                {result.verdict === 'wait' && result.months_to_save != null && (
                    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
                        <p className="text-amber-300 text-sm">
                            ⏱ You could afford this in approximately{' '}
                            <strong>{result.months_to_save}</strong> month
                            {result.months_to_save === 1 ? '' : 's'} at your current savings rate.
                        </p>
                    </div>
                )}

                {/* Adjust spending — suggested cuts */}
                {result.verdict === 'adjust_spending' &&
                    result.suggested_adjustments?.length > 0 && (
                        <div className="bg-slate-200/50 rounded-xl p-5">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase
                                       tracking-wider mb-3">
                                Suggested adjustments
                            </h3>
                            <ul className="space-y-2">
                                {result.suggested_adjustments.map((adj, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                                        <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                                        {adj}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                {/* Reset button */}
                <button
                    onClick={() => {
                        setResult(null)
                        setItemName('')
                        setItemCost('')
                        setPlannedDate('')
                    }}
                    className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-900
                               hover:bg-slate-300 rounded-lg border border-slate-400
                               transition-colors"
                >
                    Ask about another purchase
                </button>
            </div>
        )
    }

    // ─────────────────────────────────────────────────────────
    // INPUT FORM
    // ─────────────────────────────────────────────────────────
    return (
        <div className="max-w-xl mx-auto">
            <h2 className="text-base font-semibold text-slate-900 mb-1">
                Can I afford to buy this?
            </h2>
            <p className="text-sm text-slate-500 mb-6">
                Gemini will assess your current finances and give you a
                personalised recommendation.
            </p>

            {/* Error banner */}
            {error && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40
                                rounded-lg text-sm text-red-400">
                    {error}
                </div>
            )}

            <div className="space-y-4">

                {/* Item name */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        What do you want to buy?
                    </label>
                    <input
                        type="text"
                        value={item_name}
                        onChange={e => setItemName(e.target.value)}
                        placeholder='e.g. MacBook Pro, PS5, Flight to London'
                        className="w-full bg-slate-200 border border-slate-400 text-slate-900
                                   rounded-lg px-4 py-2.5 text-sm
                                   focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                                   placeholder:text-slate-600"
                    />
                </div>

                {/* Cost */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        How much does it cost?
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2
                                         text-slate-500 text-sm">$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={item_cost}
                            onChange={e => setItemCost(e.target.value)}
                            placeholder='e.g. 1200'
                            className="w-full bg-slate-200 border border-slate-400 text-slate-900
                                       rounded-lg pl-7 pr-4 py-2.5 text-sm
                                       focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                                       placeholder:text-slate-600"
                        />
                    </div>
                </div>

                {/* Planned date */}
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        When are you planning to buy it?
                    </label>
                    <input
                        type="date"
                        value={planned_date}
                        onChange={e => setPlannedDate(e.target.value)}
                        className="w-full bg-slate-200 border border-slate-400 text-slate-900
                                   rounded-lg px-4 py-2.5 text-sm
                                   focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {/* Submit */}
                <button
                    onClick={handle_submit}
                    disabled={is_loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5
                               bg-indigo-600 hover:bg-indigo-500 text-white text-sm
                               font-medium rounded-lg transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                    {is_loading ? (
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
                        '🛒 Check Affordability'
                    )}
                </button>
            </div>
        </div>
    )
}