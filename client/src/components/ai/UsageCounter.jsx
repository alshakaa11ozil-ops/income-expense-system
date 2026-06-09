/*
 * ============================================================
 * FILE    : components/ai/UsageCounter.jsx
 * LAYER   : View (component)
 * PURPOSE : Displays today's AI request quota as a coloured pill.
 *           Without this counter users are surprised by 429 errors.
 *           With it they understand the system and plan accordingly.
 * DEPENDS : Nothing — pure display component, receives data as props
 * ============================================================
 * EXPORTS:
 *   - UsageCounter : pill badge + reset countdown + cache note
 * ============================================================
 */

import React from 'react'

/*
 * COMPONENT : UsageCounter
 * ─────────────────────────────────────────────────────────
 * WHY      : Users have a daily non-cached request quota (10 for
 *            USER, 50 for ADMIN). Without visibility into that
 *            quota, hitting the limit mid-session feels like a
 *            bug. The counter shows remaining requests and, when
 *            exhausted, the approximate reset time so the user
 *            knows exactly when they can try again.
 *
 * HOW      : 1. While loading: animated skeleton pill
 *            2. When usage loaded: coloured pill keyed to remaining
 *               > 5  → indigo (healthy)
 *               1–5  → amber (warning)
 *               0    → red (exhausted)
 *            3. When remaining === 0: compute hours until midnight
 *               and show "Resets in ~X hours"
 *            4. Always: small note that cache hits are free
 *
 * @prop    {object|null} usage      - { non_cached_today, daily_limit, remaining }
 * @prop    {boolean}     is_loading
 * ─────────────────────────────────────────────────────────
 */
export default function UsageCounter({ usage, is_loading }) {

    /*
     * WHY compute hours_until_reset here rather than in the parent:
     *   This component owns the "what to show when limit is hit" logic.
     *   Moving it here keeps AiAssistantPage free of display math.
     */
    const get_hours_until_reset = () => {
        const now = new Date()
        const midnight = new Date(now)
        midnight.setHours(24, 0, 0, 0) // next midnight in local time
        return Math.ceil((midnight - now) / 3_600_000)
    }

    // ── Loading skeleton ──────────────────────────────────────
    if (is_loading) {
        return (
            <div className="flex flex-col items-end gap-1">
                <div className="h-7 w-48 rounded-full bg-slate-300 animate-pulse" />
                <div className="h-3 w-40 rounded bg-slate-200 animate-pulse" />
            </div>
        )
    }

    // ── No data (fetch failed silently) ───────────────────────
    if (!usage) {
        return (
            <div className="text-xs text-slate-500 italic">
                Usage data unavailable
            </div>
        )
    }

    const { remaining, daily_limit, non_cached_today } = usage

    // WHY derive colour from remaining rather than percentage:
    // The absolute number is what matters to the user ("I have 2 left")
    // not the fraction — at high limits a 10% remainder is still many calls.
    const pill_colour =
        remaining === 0 ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : remaining <= 5 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'

    const icon =
        remaining === 0 ? '🚫'
            : remaining <= 5 ? '⚠️'
                : '⚡'

    return (
        <div className="flex flex-col items-end gap-1.5">

            {/* ── Main pill ── */}
            <div className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full
                border text-sm font-medium
                ${pill_colour}
            `}>
                <span>{icon}</span>
                <span>
                    {remaining} of {daily_limit} request{daily_limit === 1 ? '' : 's'} remaining
                </span>
            </div>

            {/* ── Reset countdown when exhausted ── */}
            {remaining === 0 && (
                <p className="text-xs text-red-400/80">
                    Resets in ~{get_hours_until_reset()} hour{get_hours_until_reset() === 1 ? '' : 's'}
                </p>
            )}

            {/* ── Cache note — always visible ── */}
            <p className="text-[11px] text-slate-500 leading-tight text-right max-w-[220px]">
                Cached responses are free and don't count toward your limit.
            </p>

        </div>
    )
}