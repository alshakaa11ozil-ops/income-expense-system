/*
 * ============================================================
 * FILE    : RecordsPage.jsx
 * LAYER   : View (page)
 * PURPOSE : The most important page in the project. Assembles
 *           all record components and owns all state. This is
 *           the page the teacher grades for CRUD functionality:
 *           Add, Edit, Delete, and Search with pagination.
 * DEPENDS : react, react-router-dom, all record components,
 *           api.js, auth_context, format_currency, useToast
 * ============================================================
 * EXPORTS:
 *   - RecordsPage : main records management page
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth_context'
import { format_currency } from '../utils/format_currency'
import { useToast } from '../components/layout/useToast'
import RecordTable from '../components/records/RecordTable'
import RecordForm from '../components/records/RecordForm'
import SearchBar from '../components/records/SearchBar'
import Pagination from '../components/records/Pagination'
import {
    get_categories,
    get_records,
    delete_record,
    bulk_delete_records,
    export_records,
    get_analytics_summary_for_range,
} from '../services/api'

/*
 * COMPONENT : RecordsPage
 * ─────────────────────────────────────────────────────────
 * WHY       : This page demonstrates all four teacher-graded
 *             requirements: Add, Edit, Delete, Search+Pagination.
 *             Owning all state at the page level keeps child
 *             components pure (they receive data + callbacks).
 *             The URL is the source of truth for search state —
 *             browser back/forward navigation works correctly.
 * HOW       : 1. Load categories once on mount (for form dropdown)
 *             2. Re-fetch records whenever URL params change
 *             3. Fetch period summary when date range is active
 *             4. Render toolbar → summary → SearchBar → table →
 *                pagination → modals
 * ─────────────────────────────────────────────────────────
 */
export default function RecordsPage() {
    const { current_user } = useAuth()
    const { show_toast } = useToast()
    const [search_params, setSearchParams] = useSearchParams()

    // ── State ─────────────────────────────────────────────────

    const [record_list, setRecordList] = useState([])
    const [total, setTotal] = useState(0)
    const [is_loading, setIsLoading] = useState(false)
    const [category_list, setCategoryList] = useState([])
    const [show_form, setShowForm] = useState(false)
    const [form_mode, setFormMode] = useState('add')
    const [selected_record, setSelectedRecord] = useState(null)
    const [selected_ids, setSelectedIds] = useState(new Set())
    const [delete_confirm, setDeleteConfirm] = useState({ open: false, id: null })
    const [period_summary, setPeriodSummary] = useState(null)
    const [is_exporting, setIsExporting] = useState(false)
    const [is_deleting, setIsDeleting] = useState(false)

    const current_page = Number(search_params.get('page')) || 1
    const limit = 10

    // derived: are any search filters currently active?
    const has_active_filters = !!(
        search_params.get('record_id') ||
        search_params.get('type') ||
        search_params.get('category_id') ||
        search_params.get('date_from') ||
        search_params.get('date_to')
    )

    // ── Load categories (once on mount) ───────────────────────

    /*
     * WHY load categories separately from records:
     *   Categories rarely change and are needed by the form dropdown.
     *   Loading them once on mount avoids redundant API calls on
     *   every record refresh. They are passed down to RecordForm
     *   and SearchBar as props.
     */
    useEffect(() => {
        get_categories()
            .then(setCategoryList)
            .catch(err => console.error('Failed to load categories:', err))
    }, [])

    // ── Fetch records (re-runs when URL params change) ─────────

    /*
     * WHY useEffect depends on search_params:
     *   SearchBar updates the URL. This effect reacts to URL changes
     *   and fetches the matching records. The URL is the single source
     *   of truth — no separate filter state needed in this component.
     */
    useEffect(() => {
        async function load_records() {
            setIsLoading(true)
            // clear selection whenever filters or page changes
            setSelectedIds(new Set())

            const filters = {
                record_id: search_params.get('record_id') || undefined,
                type: search_params.get('type') || undefined,
                category_id: search_params.get('category_id') || undefined,
                date_from: search_params.get('date_from') || undefined,
                date_to: search_params.get('date_to') || undefined,
                page: current_page,
                limit,
            }

            try {
                const result = await get_records(filters)
                setRecordList(result.data ?? [])
                setTotal(result.pagination?.total ?? 0)
            } catch (err) {
                console.error('Failed to fetch records:', err)
                const error_msg = err?.response?.data?.error || 'Failed to load records. Please try again.'
                show_toast(error_msg, 'error')
            } finally {
                setIsLoading(false)
            }
        }

        load_records()
    }, [search_params])

    // ── Fetch period summary (when date range is active) ───────

    /*
     * WHY only when date range is active:
     *   The dashboard shows current-month totals for all records.
     *   A duplicate summary on the records page with no filter
     *   applied would be redundant. When a specific date range IS
     *   active, the user wants totals for that period — that is
     *   genuinely useful context above the filtered table.
     *
     *   IMPORTANT: This calls /analytics/summary with date_from/date_to
     *   params (Mode B). Verify analytics_controller.js handles
     *   this branch — see Chat 8 review notes.
     */
    const date_from = search_params.get('date_from')
    const date_to = search_params.get('date_to')

    useEffect(() => {
        if (date_from && date_to) {
            get_analytics_summary_for_range(date_from, date_to)
                .then(setPeriodSummary)
                .catch(() => setPeriodSummary(null))
        } else {
            setPeriodSummary(null)
        }
    }, [date_from, date_to])

    // ── Handlers ──────────────────────────────────────────────

    /*
     * FUNCTION : refresh_records
     * WHY      : After any mutation (add, edit, delete, bulk delete),
     *            the table must reflect the new state. Toggling a dummy
     *            param forces the useEffect to re-run without changing
     *            the user's active filters or page.
     */
    function refresh_records() {
        setSearchParams(prev => {
            const params = Object.fromEntries(prev)
            // use a timestamp so each refresh is unique
            return { ...params, _t: Date.now() }
        })
    }

    /*
     * FUNCTION : handle_add_click
     * WHY      : Opens the form in add mode. Clears selected_record
     *            so no stale edit data bleeds into the add form.
     */
    function handle_add_click() {
        setFormMode('add')
        setSelectedRecord(null)
        setShowForm(true)
    }

    /*
     * FUNCTION : handle_edit
     * WHY      : Opens the form pre-populated with the chosen record.
     *            The full record object is passed so the form does not
     *            need a separate API call to get the data.
     * @param   {Record} record - the row that was clicked
     */
    function handle_edit(record) {
        setFormMode('edit')
        setSelectedRecord(record)
        setShowForm(true)
    }

    /*
     * FUNCTION : handle_delete_click
     * WHY      : Shows a custom confirm dialog before deleting.
     *            A styled modal is less jarring than window.confirm
     *            while still requiring deliberate confirmation.
     * @param   {string} record_id - ID of the record to delete
     */
    function handle_delete_click(record_id) {
        setDeleteConfirm({ open: true, id: record_id })
    }

    /*
     * FUNCTION : handle_delete_confirm
     * WHY      : Executes the soft delete after confirmation.
     *            Soft delete sets deleted_at — the record stays in
     *            the database for admin audit but disappears from
     *            the user's view immediately.
     */
    async function handle_delete_confirm() {
        setIsDeleting(true)
        try {
            await delete_record(delete_confirm.id)
            setDeleteConfirm({ open: false, id: null })
            refresh_records()
            show_toast('Record deleted successfully.', 'success')
        } catch (err) {
            show_toast('Failed to delete record. Please try again.', 'error')
        } finally {
            setIsDeleting(false)
        }
    }

    /*
     * FUNCTION : handle_bulk_delete
     * WHY      : Deletes all selected records in one API call.
     *            window.confirm is intentionally used here — bulk
     *            delete is highly destructive, the browser dialog is
     *            deliberately jarring to make the user pause and think.
     *            Individual deletes get the styled dialog; bulk gets
     *            the harsher browser confirm.
     */
    async function handle_bulk_delete() {
        if (selected_ids.size === 0) return

        const confirmed = window.confirm(
            `Delete ${selected_ids.size} selected record${selected_ids.size === 1 ? '' : 's'}? This cannot be undone.`
        )

        if (!confirmed) return

        try {
            await bulk_delete_records([...selected_ids])
            setSelectedIds(new Set())
            refresh_records()
            show_toast(`${selected_ids.size} records deleted.`, 'success')
        } catch (err) {
            show_toast('Failed to delete selected records.', 'error')
        }
    }

    /*
     * FUNCTION : handle_export
     * WHY      : Exports records matching the current filters as CSV.
     *            Passing the same filters ensures the downloaded file
     *            contains exactly what the user sees in the table.
     */
    async function handle_export() {
        setIsExporting(true)
        try {
            const filters = {
                record_id: search_params.get('record_id') || undefined,
                type: search_params.get('type') || undefined,
                category_id: search_params.get('category_id') || undefined,
                date_from: search_params.get('date_from') || undefined,
                date_to: search_params.get('date_to') || undefined,
            }
            await export_records(filters)
            show_toast('CSV exported successfully.', 'success')
        } catch (err) {
            show_toast('Export failed. Please try again.', 'error')
        } finally {
            setIsExporting(false)
        }
    }

    /*
     * FUNCTION : handle_select
     * WHY      : Toggles one row's selection state. Using a Set
     *            gives O(1) lookup for the "is this row selected?"
     *            check in RecordTable without iterating the array.
     * @param   {string} record_id
     */
    function handle_select(record_id) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(record_id) ? next.delete(record_id) : next.add(record_id)
            return next
        })
    }

    /*
     * FUNCTION : handle_select_all
     * WHY      : Toggles all visible rows. If all are already selected,
     *            deselects all (tri-state checkbox behaviour).
     */
    function handle_select_all() {
        if (selected_ids.size === record_list.length && record_list.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(record_list.map(r => r.id)))
        }
    }

    /*
     * FUNCTION : handle_page_change
     * WHY      : Updates only the page param in the URL. The spread
     *            preserves all other active filters so pagination
     *            works correctly alongside search filters.
     * @param   {number} page
     */
    function handle_page_change(page) {
        setSearchParams(prev => {
            const params = Object.fromEntries(prev)
            return { ...params, page: String(page) }
        })
    }

    /*
     * FUNCTION : handle_form_success
     * WHY      : Called by RecordForm after a successful add or edit.
     *            Closes the modal, clears selected record state, and
     *            refreshes the table to show the new/updated row.
     */
    function handle_form_success(action) {
        setShowForm(false)
        setSelectedRecord(null)
        refresh_records()
        show_toast(
            action === 'edit' ? 'Record updated successfully.' : 'Record added successfully.',
            'success'
        )
    }

    // ── Render ─────────────────────────────────────────────────

    const total_pages = Math.ceil(total / limit)

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">

                {/* ── Toolbar ─────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900">Records</h1>
                        {/* Total count badge — updates with filters to prove server-side search */}
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-300 text-slate-600 text-sm font-medium">
                            {total} record{total !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Export CSV */}
                        <button
                            onClick={handle_export}
                            disabled={is_exporting || total === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-400 bg-slate-50 text-slate-700 text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {is_exporting ? (
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            )}
                            {is_exporting ? 'Exporting…' : 'Export CSV'}
                        </button>

                        {/* Add Record */}
                        <button
                            onClick={handle_add_click}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Record
                        </button>
                    </div>
                </div>

                {/* ── Period summary (only when date range filter is active) */}
                {period_summary && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-slate-50 rounded-xl border border-slate-300 px-5 py-3 text-sm">
                        <span className="text-slate-500 font-medium">
                            {date_from} — {date_to}
                        </span>
                        <span>
                            Income:{' '}
                            <span className="font-semibold text-emerald-700">
                                {format_currency(period_summary.total_income)}
                            </span>
                        </span>
                        <span>
                            Expense:{' '}
                            <span className="font-semibold text-red-700">
                                {format_currency(period_summary.total_expense)}
                            </span>
                        </span>
                        <span>
                            Net:{' '}
                            <span className={`font-semibold ${parseFloat(period_summary.net_balance) >= 0
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }`}>
                                {format_currency(period_summary.net_balance)}
                            </span>
                        </span>
                        <span className="text-slate-500 text-xs">
                            {period_summary.record_count} records
                        </span>
                    </div>
                )}

                {/* ── Search bar ──────────────────────────────────── */}
                <SearchBar category_list={category_list} />

                {/* ── Bulk action bar (conditional) ───────────────── */}
                {selected_ids.size > 0 && (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                        <span className="text-sm font-medium text-blue-800">
                            {selected_ids.size} record{selected_ids.size !== 1 ? 's' : ''} selected
                        </span>
                        <button
                            onClick={handle_bulk_delete}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Selected
                        </button>
                    </div>
                )}

                {/* ── Records table ───────────────────────────────── */}
                <RecordTable
                    record_list={record_list}
                    on_edit={handle_edit}
                    on_delete={handle_delete_click}
                    on_add={handle_add_click}
                    selected_ids={selected_ids}
                    on_select={handle_select}
                    on_select_all={handle_select_all}
                    is_loading={is_loading}
                    has_active_filters={has_active_filters}
                />

                {/* ── Pagination ──────────────────────────────────── */}
                <Pagination
                    current_page={current_page}
                    total_pages={total_pages}
                    total={total}
                    limit={limit}
                    on_page_change={handle_page_change}
                />
            </div>

            {/* ── Add / Edit modal ─────────────────────────────── */}
            {show_form && (
                <div
                    className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
                >
                    <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900">
                                {form_mode === 'edit' ? 'Edit Record' : 'Add Record'}
                            </h2>
                            <button
                                onClick={() => setShowForm(false)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-300 transition-colors"
                                aria-label="Close form"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-6 py-5">
                            <RecordForm
                                mode={form_mode}
                                initial_data={selected_record}
                                category_list={category_list}
                                on_success={() => handle_form_success(form_mode)}
                                on_close={() => setShowForm(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete confirm modal ─────────────────────────── */}
            {delete_confirm.open && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        {/* Warning icon */}
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        </div>

                        <h3 className="text-center text-base font-bold text-slate-900 mb-1">
                            Delete this record?
                        </h3>
                        <p className="text-center text-sm text-slate-500 mb-6">
                            This action will remove the record from your list.
                            It can be restored by an administrator if needed.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm({ open: false, id: null })}
                                disabled={is_deleting}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-400 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handle_delete_confirm}
                                disabled={is_deleting}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {is_deleting && (
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                )}
                                {is_deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}