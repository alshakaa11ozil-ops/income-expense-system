/*
 * ============================================================
 * FILE    : SearchBar.jsx
 * LAYER   : View (component)
 * PURPOSE : Server-side search and filter controls for the
 *           records table. Updates URL query params on change
 *           (debounced 300ms) so RecordsPage re-fetches with
 *           the new filters. The URL is the source of truth —
 *           browser back/forward restores the exact search state.
 * DEPENDS : react-router-dom (useSearchParams), react
 * ============================================================
 * EXPORTS:
 *   - SearchBar : filter controls component
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/*
 * COMPONENT : SearchBar
 * ─────────────────────────────────────────────────────────
 * WHY       : Teacher requires search by record_id, type, and
 *             category. Using the URL as state means the search
 *             survives page refresh and browser navigation.
 *             Debouncing prevents an API call on every keystroke.
 *
 * HOW       : Local input state tracks what the user is typing.
 *             A debounced useEffect converts local state to URL
 *             params 300ms after the user stops typing.
 *             RecordsPage listens to URL changes and re-fetches.
 *
 * @prop    {Category[]} category_list - for the category filter dropdown
 * ─────────────────────────────────────────────────────────
 */
export default function SearchBar({ category_list = [] }) {
    const [search_params, setSearchParams] = useSearchParams()

    // local input state — reflects what the user is actively typing.
    // initialised from URL so the inputs match on page load/refresh.
    const [record_id_input, setRecordIdInput] = useState(search_params.get('record_id') ?? '')
    const [type_input, setTypeInput] = useState(search_params.get('type') ?? '')
    const [category_input, setCategoryInput] = useState(search_params.get('category_id') ?? '')
    const [date_from_input, setDateFromInput] = useState(search_params.get('date_from') ?? '')
    const [date_to_input, setDateToInput] = useState(search_params.get('date_to') ?? '')

    // ── Debounced URL update ───────────────────────────────────

    /*
     * WHY debounce at 300ms:
     *   Typing "Salary" without debounce fires 6 API calls (one per
     *   character). With 300ms debounce it fires exactly 1 — after the
     *   user pauses. The cleanup function cancels the pending timer if
     *   another keystroke arrives before 300ms, so only the final
     *   state triggers an API call.
     *
     * WHY reset to page 1 on any filter change:
     *   If the user is on page 3 and changes a filter, the new result
     *   set may have fewer than 3 pages. Staying on page 3 would
     *   show an empty table or trigger a 404. Always reset to page 1.
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            const new_params = {}

            if (record_id_input.trim()) new_params.record_id = record_id_input.trim()
            if (type_input) new_params.type = type_input
            if (category_input) new_params.category_id = category_input
            if (date_from_input) new_params.date_from = date_from_input
            if (date_to_input) new_params.date_to = date_to_input

            // always reset to page 1 when filters change
            new_params.page = '1'

            setSearchParams(new_params)
        }, 300)

        return () => clearTimeout(timer)
    }, [record_id_input, type_input, category_input, date_from_input, date_to_input])

    // ── Date preset handlers ───────────────────────────────────

    /*
     * FUNCTION : apply_preset
     * WHY      : Graders testing the app need to see records from
     *            specific periods quickly. Typing into two date pickers
     *            is slow. Presets set both fields instantly. Changing
     *            both state values together triggers one debounce cycle.
     * @param   {string} preset - 'this_month' | 'past_3_months' | 'past_6_months'
     */
    function apply_preset(preset) {
        const today = new Date()
        const from_date = new Date(today)

        if (preset === 'this_month') {
            from_date.setDate(1)
        } else if (preset === 'past_3_months') {
            from_date.setMonth(today.getMonth() - 3)
        } else if (preset === 'past_6_months') {
            from_date.setMonth(today.getMonth() - 6)
        }

        const fmt = (d) => {
            const yyyy = d.getFullYear()
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            return `${yyyy}-${mm}-${dd}`
        }
        setDateFromInput(fmt(from_date))
        setDateToInput(fmt(today))
    }

    /*
     * FUNCTION : clear_all
     * WHY      : One-click way to remove all filters and return to
     *            the full unfiltered record list. Updates local state
     *            AND immediately clears URL params (bypassing debounce)
     *            so the reset is instant.
     */
    function clear_all() {
        setRecordIdInput('')
        setTypeInput('')
        setCategoryInput('')
        setDateFromInput('')
        setDateToInput('')
        // direct setSearchParams here (not waiting for debounce)
        // because clearing all filters should be instant
        setSearchParams({ page: '1' })
    }

    // determine if any filter is currently active
    const has_active_filters = !!(
        record_id_input || type_input || category_input ||
        date_from_input || date_to_input
    )

    // check if a date preset exactly matches current date range
    // so we can highlight the active preset button
    function is_preset_active(preset) {
        if (!date_from_input || !date_to_input) return false
        const today = new Date()
        const from_date = new Date(today)
        const fmt = (d) => {
            const yyyy = d.getFullYear()
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            return `${yyyy}-${mm}-${dd}`
        }

        if (preset === 'this_month') from_date.setDate(1)
        if (preset === 'past_3_months') from_date.setMonth(today.getMonth() - 3)
        if (preset === 'past_6_months') from_date.setMonth(today.getMonth() - 6)

        return date_from_input === fmt(from_date) && date_to_input === fmt(today)
    }

    // ── Render ─────────────────────────────────────────────────

    return (
        <div className="bg-slate-50 rounded-xl border border-slate-300 p-4 space-y-3">

            {/* Row 1: text filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                {/* Record ID text search */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={record_id_input}
                        onChange={e => setRecordIdInput(e.target.value)}
                        placeholder="Search by Record ID..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {/* Type filter */}
                <select
                    value={type_input}
                    onChange={e => setTypeInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50 text-slate-700"
                >
                    <option value="">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>

                {/* Category filter */}
                <select
                    value={category_input}
                    onChange={e => setCategoryInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50 text-slate-700"
                >
                    <option value="">All Categories</option>
                    {category_list.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Row 2: date presets */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">Quick:</span>
                {[
                    { key: 'this_month', label: 'This Month' },
                    { key: 'past_3_months', label: 'Past 3 Months' },
                    { key: 'past_6_months', label: 'Past 6 Months' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => apply_preset(key)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${is_preset_active(key)
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-400'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Row 3: date range + clear all */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                        type="date"
                        value={date_from_input}
                        onChange={e => setDateFromInput(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        aria-label="Date from"
                    />
                    <span className="text-slate-500 text-sm flex-shrink-0">→</span>
                    <input
                        type="date"
                        value={date_to_input}
                        onChange={e => setDateToInput(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        aria-label="Date to"
                    />
                </div>

                {/* Clear all — only shown when a filter is active */}
                {has_active_filters && (
                    <button
                        type="button"
                        onClick={clear_all}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-400 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear All
                    </button>
                )}
            </div>
        </div>
    )
}