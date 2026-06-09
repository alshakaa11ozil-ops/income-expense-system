/*
 * ============================================================
 * FILE    : AdminAiUsageTab.jsx
 * LAYER   : View (component)
 * PURPOSE : Tab 4 — AI usage log across all users.
 *           Shows feature popularity, cache hit ratio, token costs.
 *           Two filter dimensions: time range (API call) + feature
 *           type (client-side filter on fetched data).
 * DEPENDS : admin_get_ai_usage, useToast
 * ============================================================
 * EXPORTS:
 *   - AdminAiUsageTab : main component
 * ============================================================
 */

import { useState, useEffect, useMemo } from 'react'
import { admin_get_ai_usage } from '../../services/api'
import { useToast } from '../layout/useToast'

/*
 * COMPONENT : AdminAiUsageTab
 * ─────────────────────────────────────────────────────────
 * WHY      : Surfaces AI caching efficiency and per-feature usage.
 *            Cache hits (⚡) show the AI caching backend is working.
 *            Two filter dimensions keep the UI flexible without
 *            extra API calls for every filter change.
 */
export default function AdminAiUsageTab() {
    const [usage_log, setUsageLog] = useState([])
    const [days_back, setDaysBack] = useState(7)

    /*
     * WHY two filter dimensions:
     *   days_back → controls the API call (fetches different data).
     *   feature_filter → client-side filter on already-fetched log.
     *   This avoids a new API call every time the feature pill changes.
     */
    const [feature_filter, setFeatureFilter] = useState('all')
    const [is_loading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const { show_toast } = useToast()

    async function load_usage() {
        setIsLoading(true)
        setError(null)
        try {
            const data = await admin_get_ai_usage(days_back)
            setUsageLog(data)
        } catch {
            setError('Failed to load AI usage data.')
            show_toast('Failed to load AI usage data. Please try again.', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        setFeatureFilter('all')  // reset feature filter when time range changes
        load_usage()
    }, [days_back])

    // ── Client-side feature filter ────────────────────────────
    const filtered_log = useMemo(() => {
        if (feature_filter === 'all') return usage_log
        return usage_log.filter(r => r.feature_name === feature_filter)
    }, [usage_log, feature_filter])

    // ── Derived summary stats ─────────────────────────────────
    const total_requests = filtered_log.length
    const cached = filtered_log.filter(r => r.was_cached).length
    const api_calls = total_requests - cached

    /*
     * WHY guard on total_requests (not cached):
     *   If total_requests === 0, cached/total_requests = NaN.
     *   Guarding on total_requests prevents "NaN%" on screen.
     */
    const cache_ratio = total_requests === 0
        ? '0'
        : ((cached / total_requests) * 100).toFixed(1)

    const total_tokens = filtered_log.reduce((s, r) => s + (r.tokens_used || 0), 0)

    // ── Feature label map ─────────────────────────────────────
    const feature_labels = {
        plan_expenses:    '💰 Budget Planner',
        advise_purchase:  '🛒 Purchase Advisor',
        analyze_finances: '💬 Finance Chat',
    }

    function get_feature_label(name) {
        return feature_labels[name] ?? name
    }

    // ── Time pills config ─────────────────────────────────────
    const time_pills = [
        { label: 'Last 7 days',  value: 7  },
        { label: 'Last 14 days', value: 14 },
        { label: 'Last 30 days', value: 30 },
    ]

    // ── Feature pills config ──────────────────────────────────
    const feature_pills = [
        { label: 'All Features',       value: 'all'              },
        { label: '💰 Budget Planner',  value: 'plan_expenses'    },
        { label: '🛒 Purchase Advisor',value: 'advise_purchase'  },
        { label: '💬 Finance Chat',    value: 'analyze_finances' },
    ]

    function format_datetime(ts) {
        if (!ts) return '—'
        return new Date(ts).toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
    }

    // ── Inline error card ─────────────────────────────────────
    if (error && !is_loading) {
        return (
            <div className="space-y-4">
                {/* keep filter pills visible so user can retry with different params */}
                <div className="flex flex-wrap gap-2">
                    {time_pills.map(p => (
                        <button key={p.value} onClick={() => setDaysBack(p.value)}
                            className={`px-3 py-1 text-sm rounded-full transition-colors ${days_back === p.value ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-400'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 flex items-center justify-between">
                    <span className="text-red-400">⚠️ {error}</span>
                    <button onClick={load_usage}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm">
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">

            {/* ── Time range filter pills (row 1) ───────────── */}
            <div className="flex flex-wrap gap-2">
                {time_pills.map(p => (
                    <button
                        key={p.value}
                        onClick={() => setDaysBack(p.value)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            days_back === p.value
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-200 text-slate-500 hover:bg-slate-400'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* ── Feature filter pills (row 2, client-side) ─── */}
            <div className="flex flex-wrap gap-2">
                {feature_pills.map(p => (
                    <button
                        key={p.value}
                        onClick={() => setFeatureFilter(p.value)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            feature_filter === p.value
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-slate-200 text-slate-500 hover:bg-slate-400'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* ── Summary pills ─────────────────────────────── */}
            {!is_loading && (
                <div className="flex flex-wrap gap-3">
                    {[
                        { label: `Total: ${total_requests}` },
                        { label: `Cached: ${cached} (${cache_ratio}%)` },
                        { label: `API Calls: ${api_calls}` },
                        { label: `Tokens: ${total_tokens}` },
                    ].map(p => (
                        <span key={p.label}
                            className="px-3 py-1 bg-slate-200 text-slate-500 text-xs rounded-full border border-slate-400">
                            {p.label}
                        </span>
                    ))}
                </div>
            )}

            {/* ── Loading skeleton ──────────────────────────── */}
            {is_loading && (
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-14 bg-slate-200 rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── Empty state ───────────────────────────────── */}
            {!is_loading && filtered_log.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    No{feature_filter !== 'all' ? ` ${get_feature_label(feature_filter)}` : ''} AI usage in the last {days_back} days.
                </div>
            )}

            {/* ── Usage table ───────────────────────────────── */}
            {!is_loading && filtered_log.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-400">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-400 bg-slate-200/80">
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">User</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Feature</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Type</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Tokens</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered_log.map((row, i) => (
                                <tr key={row.id ?? i}
                                    className="border-b border-slate-400/50 bg-slate-200 hover:bg-slate-400/50 transition-colors">

                                    {/* User */}
                                    <td className="px-4 py-3">
                                        <p className="text-slate-900 text-sm">{row.user?.username ?? '—'}</p>
                                        <p className="text-slate-500 text-xs">{row.user?.email ?? ''}</p>
                                    </td>

                                    {/* Feature */}
                                    <td className="px-4 py-3 text-slate-600">
                                        {get_feature_label(row.feature_name)}
                                    </td>

                                    {/* Type badge */}
                                    <td className="px-4 py-3">
                                        {row.was_cached ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">
                                                ⚡ Cached
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400">
                                                API Call
                                            </span>
                                        )}
                                    </td>

                                    {/* Tokens — cache hits use no tokens */}
                                    <td className="px-4 py-3 text-slate-500">
                                        {row.was_cached ? '—' : (row.tokens_used ?? '—')}
                                    </td>

                                    {/* Date */}
                                    <td className="px-4 py-3 text-slate-500">
                                        {format_datetime(row.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
