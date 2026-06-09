/*
 * ============================================================
 * FILE    : RecordTable.jsx
 * LAYER   : View (component)
 * PURPOSE : Renders the paginated list of income/expense records.
 *           Each row has Edit and Delete action buttons, which is
 *           a direct teacher requirement for Q13. Type is shown
 *           as a coloured badge. Category shows icon + name.
 * DEPENDS : format_currency (utils), react (useRef, useEffect)
 * ============================================================
 * EXPORTS:
 *   - RecordTable : main table component
 * ============================================================
 */

import { useRef, useEffect } from 'react'
import { format_currency } from '../../utils/format_currency'

/*
 * COMPONENT : RecordTable
 * ─────────────────────────────────────────────────────────
 * WHY       : The teacher requires Edit and Delete to be directly
 *             accessible from the list view — not buried in a
 *             separate detail page. Each row has both buttons.
 *             Type badges (green/red) allow instant scanning.
 *             Category shows the icon + name from the joined
 *             Category object — not a raw category_id string.
 *
 * HOW       : Renders an HTML <table> with one <tr> per record.
 *             Skeleton rows are shown during loading to prevent
 *             layout shift. The header checkbox uses the DOM
 *             `indeterminate` property for tri-state behaviour.
 *
 * @prop    {Record[]} record_list              - records for current page
 * @prop    {Function} on_edit(record)          - opens edit form
 * @prop    {Function} on_delete(record_id)     - triggers delete confirm
 * @prop    {Function} on_add()                 - opens add form (for empty state CTA)
 * @prop    {Set}      selected_ids             - Set of currently selected record IDs
 * @prop    {Function} on_select(record_id)     - toggles one row's selection
 * @prop    {Function} on_select_all()          - toggles all visible rows
 * @prop    {boolean}  is_loading               - shows skeleton rows when true
 * @prop    {boolean}  has_active_filters       - changes empty state message
 * ─────────────────────────────────────────────────────────
 */
export default function RecordTable({
    record_list = [],
    on_edit,
    on_delete,
    on_add,
    selected_ids = new Set(),
    on_select,
    on_select_all,
    is_loading = false,
    has_active_filters = false,
}) {
    // ref to the header checkbox — needed to set indeterminate state
    // indeterminate is a DOM property, not an HTML attribute, so React
    // cannot set it declaratively. We use a ref and set it imperatively.
    const header_checkbox_ref = useRef(null)

    /*
     * WHY useEffect for indeterminate:
     *   The tri-state checkbox (checked / indeterminate / unchecked)
     *   requires direct DOM manipulation. React's checked prop only
     *   covers two states. The effect re-runs whenever selection changes.
     */
    useEffect(() => {
        const cb = header_checkbox_ref.current
        if (!cb) return

        const all_selected = record_list.length > 0 && selected_ids.size === record_list.length
        const some_selected = selected_ids.size > 0 && selected_ids.size < record_list.length

        cb.checked = all_selected
        cb.indeterminate = some_selected
    }, [selected_ids, record_list])

    // ── Skeleton rows ────────────────────────────────────────────
    // shown while the API call is in flight — prevents layout shift
    if (is_loading) {
        return (
            <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="min-w-full divide-y divide-slate-200">
                    <TableHead
                        header_checkbox_ref={header_checkbox_ref}
                        on_select_all={on_select_all}
                    />
                    <tbody className="bg-slate-50 divide-y divide-slate-100">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                                {/* 9 columns: checkbox + 7 data + 1 actions */}
                                {Array.from({ length: 9 }).map((_, j) => (
                                    <td key={j} className="px-4 py-3">
                                        <div className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: j === 0 ? '1rem' : '80%' }} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    // ── Empty state ──────────────────────────────────────────────
    if (record_list.length === 0) {
        return (
            <div className="rounded-xl border border-slate-300 bg-slate-50">
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <span className="text-5xl mb-4" role="img" aria-label="receipt">🧾</span>
                    <h3 className="text-base font-semibold text-slate-700 mb-1">No records found</h3>
                    {has_active_filters ? (
                        <p className="text-sm text-slate-500">
                            Try adjusting your search filters.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-slate-500 mb-4">
                                Add your first income or expense record to get started.
                            </p>
                            {on_add && (
                                <button
                                    onClick={on_add}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Record
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    }

    // ── Full table ───────────────────────────────────────────────
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-300">
            <table className="min-w-full divide-y divide-slate-200">
                <TableHead
                    header_checkbox_ref={header_checkbox_ref}
                    on_select_all={on_select_all}
                />
                <tbody className="bg-slate-50 divide-y divide-slate-100">
                    {record_list.map(record => (
                        <RecordRow
                            key={record.id}
                            record={record}
                            is_selected={selected_ids.has(record.id)}
                            on_select={() => on_select(record.id)}
                            on_edit={() => on_edit(record)}
                            on_delete={() => on_delete(record.id)}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

/*
 * COMPONENT : TableHead
 * WHY       : Extracted to reuse across full table and skeleton.
 *             The header checkbox ref must be passed down because
 *             the parent owns the ref and sets indeterminate state.
 */
function TableHead({ header_checkbox_ref, on_select_all }) {
    return (
        <thead className="bg-slate-100">
            <tr>
                <th className="w-10 px-4 py-3">
                    <input
                        ref={header_checkbox_ref}
                        type="checkbox"
                        onChange={on_select_all}
                        className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                        aria-label="Select all records"
                    />
                </th>
                {['ID', 'Type', 'Amount', 'Category', 'Date', 'Operator', 'Notes', 'Actions'].map(col => (
                    <th
                        key={col}
                        className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left ${col === 'Amount' ? 'text-right' : ''}`}
                    >
                        {col}
                    </th>
                ))}
            </tr>
        </thead>
    )
}

/*
 * COMPONENT : RecordRow
 * WHY       : Each row encapsulates its own rendering logic.
 *             Keeping it here (not in a separate file) avoids
 *             an extra import while keeping RecordTable readable.
 */
function RecordRow({ record, is_selected, on_select, on_edit, on_delete }) {
    /*
     * WHY format date manually:
     *   new Date(record.date).toLocaleDateString() is timezone-sensitive.
     *   "2026-05-28" stored as a Date field arrives as "2026-05-28T00:00:00Z".
     *   Calling toLocaleDateString in UTC-negative zones shows "27 May 2026".
     *   Slicing the ISO string avoids this off-by-one error.
     */
    const date_parts = record.date
        ? record.date.split('T')[0].split('-')
        : []
    const formatted_date = date_parts.length === 3
        ? `${date_parts[2]} ${MONTH_NAMES[parseInt(date_parts[1], 10) - 1]} ${date_parts[0]}`
        : '—'

    const truncated_notes = record.notes && record.notes.length > 40
        ? record.notes.slice(0, 40) + '…'
        : (record.notes ?? '—')

    return (
        <tr className={`transition-colors ${is_selected ? 'bg-blue-50' : 'hover:bg-slate-200'}`}>
            {/* Checkbox */}
            <td className="px-4 py-3">
                <input
                    type="checkbox"
                    checked={is_selected}
                    onChange={on_select}
                    className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                    aria-label={`Select record ${record.id}`}
                />
            </td>

            {/* Record ID */}
            <td className="px-4 py-3">
                <span className="font-mono text-xs text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                    {record.id}
                </span>
            </td>

            {/* Type badge */}
            <td className="px-4 py-3">
                {record.type === 'income' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        ↑ Income
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        ↓ Expense
                    </span>
                )}
            </td>

            {/* Amount — right aligned, coloured by type */}
            <td className={`px-4 py-3 text-right font-semibold text-sm ${record.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                {format_currency(record.amount)}
            </td>

            {/* Category — icon + name with coloured left dot */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    {record.category?.color && (
                        <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: record.category.color }}
                        />
                    )}
                    <span className="text-sm text-slate-700">
                        {record.category?.icon} {record.category?.name ?? '—'}
                    </span>
                </div>
            </td>

            {/* Date */}
            <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                {formatted_date}
            </td>

            {/* Operator */}
            <td className="px-4 py-3 text-sm text-slate-600">
                {record.operator ?? '—'}
            </td>

            {/* Notes — truncated, full text on hover via title attribute */}
            <td
                className="px-4 py-3 text-sm text-slate-500 max-w-[10rem]"
                title={record.notes ?? ''}
            >
                {truncated_notes}
            </td>

            {/* Action buttons — teacher requirement: both in every row */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                    {/* Edit */}
                    <button
                        onClick={on_edit}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        aria-label={`Edit record ${record.id}`}
                        title="Edit"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>

                    {/* Delete */}
                    <button
                        onClick={on_delete}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label={`Delete record ${record.id}`}
                        title="Delete"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    )
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]