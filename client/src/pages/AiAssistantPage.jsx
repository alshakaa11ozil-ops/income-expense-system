/*
 * ============================================================
 * FILE    : pages/AiAssistantPage.jsx
 * LAYER   : View (page)
 * PURPOSE : AI assistant page — three tabs for the three Gemini
 *           features. Owns the usage counter state and passes
 *           on_request_complete down to each tab so the counter
 *           updates after every AI call without the tabs needing
 *           to know about the usage API directly.
 *           Renders inside Layout — sidebar already present.
 * DEPENDS : UsageCounter, ExpensePlanner, PurchaseAdvisor,
 *           AnalysisChat, api (get_ai_usage), auth_context
 * ============================================================
 * EXPORTS:
 *   - AiAssistantPage : /ai route component
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react'
import UsageCounter from '../components/ai/UsageCounter'
import ExpensePlanner from '../components/ai/ExpensePlanner'
import PurchaseAdvisor from '../components/ai/PurchaseAdvisor'
import AnalysisChat from '../components/ai/AnalysisChat'
import { get_ai_usage } from '../services/api'
import { useAuth } from '../context/auth_context'

// ── Tab definitions ───────────────────────────────────────────
const TABS = [
    { id: 'planner', label: '📊 Budget Planner' },
    { id: 'advisor', label: '🛒 Purchase Advisor' },
    { id: 'chat', label: '💬 Finance Chat' },
]

/*
 * COMPONENT : AiAssistantPage
 * ─────────────────────────────────────────────────────────
 * WHY      : Three AI features live on one page as tabs because:
 *            1. They all consume from the same daily quota.
 *            2. A single usage counter in the header applies to all.
 *            3. Keeping them together makes the quota relationship
 *               visually explicit — users see the count regardless
 *               of which feature they use.
 *
 * HOW      : 1. On mount: fetch today's AI usage
 *            2. Cache the result for 60 seconds to avoid a fetch
 *               every time the user switches tabs
 *            3. on_request_complete invalidates the cache and
 *               immediately re-fetches (called by each tab after
 *               a successful AI API call)
 *            4. Render header row + tab nav + active tab content
 *
 * @route   /ai — protected, any authenticated user
 * ─────────────────────────────────────────────────────────
 */
export default function AiAssistantPage() {
    const [active_tab, setActiveTab] = useState('planner')
    const [usage, setUsage] = useState(null)
    const [usage_loading, setUsageLoading] = useState(true)
    const [usage_fetched_at, setUsageFetchedAt] = useState(null)

    const { current_user } = useAuth()

    /*
     * FUNCTION : load_usage
     * WHY      : The usage counter only changes after an AI request
     *            completes — not on tab switches. Caching 60 seconds
     *            prevents a redundant fetch every time the user moves
     *            between tabs. on_request_complete resets the cache
     *            so the count is always accurate after a real call.
     */
    const load_usage = useCallback(async () => {
        const now = Date.now()
        // WHY 60-second cache: see above
        if (usage_fetched_at && now - usage_fetched_at < 60_000) return

        setUsageLoading(true)
        try {
            const data = await get_ai_usage()
            setUsage(data)
            setUsageFetchedAt(Date.now())
        } catch {
            // Non-critical — counter shows "unavailable" gracefully
        } finally {
            setUsageLoading(false)
        }
    }, [usage_fetched_at])

    useEffect(() => {
        load_usage()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    // WHY empty deps: we only want to trigger on mount.
    // Tab switches re-use the cached value. on_request_complete
    // handles post-call refreshes via cache invalidation.

    /*
     * FUNCTION : handle_request_complete
     * WHY      : Passed to each tab as on_request_complete.
     *            Invalidating the cache and immediately calling
     *            load_usage means the counter reflects the latest
     *            state within milliseconds of a completed AI call.
     */
    const handle_request_complete = useCallback(() => {
        setUsageFetchedAt(null)  // invalidate cache
        // Brief delay so the backend usage record is committed
        // before we fetch — avoids a race condition on fast responses
        setTimeout(() => {
            setUsageLoading(true)
            get_ai_usage()
                .then(data => { setUsage(data); setUsageFetchedAt(Date.now()) })
                .catch(() => { }) // non-critical
                .finally(() => setUsageLoading(false))
        }, 500)
    }, [])

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">

            {/* ── Page header row ── */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        AI Financial Assistant
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Powered by Google Gemini · your financial data stays private
                    </p>
                </div>

                <UsageCounter usage={usage} is_loading={usage_loading} />
            </div>

            {/* ── Tab navigation ── */}
            <div className="flex gap-1 mb-6 bg-slate-200/50 rounded-xl p-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex-1 py-2.5 px-3 rounded-lg text-sm font-medium
                            transition-all duration-200
                            ${active_tab === tab.id
                                ? 'bg-slate-300 text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab content ── */}
            <div className="bg-slate-50/50 border border-slate-300 rounded-2xl p-6">
                {active_tab === 'planner' && (
                    <ExpensePlanner on_request_complete={handle_request_complete} />
                )}
                {active_tab === 'advisor' && (
                    <PurchaseAdvisor on_request_complete={handle_request_complete} />
                )}
                {active_tab === 'chat' && (
                    <AnalysisChat on_request_complete={handle_request_complete} />
                )}
            </div>
        </div>
    )
}