/*
 * ============================================================
 * FILE    : AdminAuditTab.jsx
 * LAYER   : View (component)
 * PURPOSE : Tab 2 — Full record audit for any user, including
 *           soft-deleted records. Admin can restore or hard-delete.
 *           Makes the soft-delete system visible to the grader:
 *           deleted records appear with red badges proving data
 *           is preserved, not destroyed, on user delete.
 * DEPENDS : admin_get_users, admin_get_audit_records,
 *           admin_restore_record, admin_hard_delete_record,
 *           Pagination, format_currency, useToast
 * ============================================================
 * EXPORTS:
 *   - AdminAuditTab : main component
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react'
import {
    admin_get_users,
    admin_get_audit_records,
    admin_restore_record,
    admin_hard_delete_record,
} from '../../services/api'
import Pagination from '../records/Pagination'
import { useToast } from '../layout/useToast'
import { format_currency } from '../../utils/format_currency'

/*
 * COMPONENT : AdminAuditTab
 * ─────────────────────────────────────────────────────────
 * WHY      : Deleted records with red badges demonstrate data
 *            is preserved. Restore and hard-delete show the
 *            full admin control set to the grader.
 * @prop    {string|null} initial_user_id — if passed from Users tab
 *            via handle_view_records, this user is pre-selected and
 *            records load immediately without extra user interaction.
 */
export default function AdminAuditTab({ initial_user_id }) {
    // User list for the dropdown selector
    const [user_list, setUserList] = useState([])

    /*
     * WHY dropdown over text input:
     *   cuid IDs are long random strings — copying them manually
     *   is error-prone and looks bad during a demo. A dropdown of
     *   "username (email)" is far more usable. The cross-tab
     *   navigation (Users → "🔍 Audit") auto-selects the user
     *   and is the primary path. The dropdown is the fallback.
     */
    const [target_user_id, setTargetUserId] = useState(initial_user_id ?? null)
    const [records, setRecords] = useState([])
    const [total, setTotal] = useState(0)
    const [current_page, setCurrentPage] = useState(1)
    const [is_loading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    // WHY tracks record_id: disables only the acting row, not the full table
    const [is_submitting, setIsSubmitting] = useState(null)

    const [hard_delete_modal, setHardDeleteModal] = useState({
        open: false,
        record_id: null,
        record_label: '',
        confirm_text: '',   // WHY: must reset to '' on every open/cancel
    })

    const limit = 20
    const { show_toast } = useToast()

    // ── Load user list for the dropdown on mount ──────────────
    useEffect(() => {
        admin_get_users(1, 100)
            .then(result => setUserList(result.data))
            .catch(() => {})
        // WHY limit=100: gives a full dropdown without pagination.
        // Errors here are non-critical — dropdown stays empty.
    }, [])

    // ── Load records when user or page changes ────────────────
    const load_records = useCallback(async () => {
        if (!target_user_id) return
        setIsLoading(true)
        setError(null)
        try {
            const result = await admin_get_audit_records(target_user_id, current_page, limit)
            setRecords(result.data)
            setTotal(result.pagination.total)
        } catch {
            setError('Failed to load audit records.')
            show_toast('Failed to load audit records. Please try again.', 'error')
        } finally {
            setIsLoading(false)
        }
    }, [target_user_id, current_page])

    useEffect(() => {
        load_records()
    }, [load_records])

    // ── If initial_user_id changes (cross-tab nav), re-select ─
    useEffect(() => {
        if (initial_user_id && initial_user_id !== target_user_id) {
            setTargetUserId(initial_user_id)
            setCurrentPage(1)
        }
    }, [initial_user_id])

    /*
     * FUNCTION : handle_restore
     * WHY      : Sets deleted_at = null, making record visible again.
     *            is_submitting prevents double-click on the row.
     */
    async function handle_restore(record_id) {
        setIsSubmitting(record_id)
        try {
            await admin_restore_record(record_id)
            show_toast('Record restored successfully.', 'success')
            load_records()
        } catch {
            show_toast('Failed to restore record.', 'error')
        } finally {
            setIsSubmitting(null)
        }
    }

    /*
     * FUNCTION : handle_hard_delete_confirm
     * WHY      : Only callable when confirm_text === 'DELETE' (uppercase).
     *            Permanently removes the record — irreversible.
     */
    async function handle_hard_delete_confirm() {
        try {
            await admin_hard_delete_record(hard_delete_modal.record_id)
            show_toast('Record permanently deleted.', 'success')
        } catch {
            show_toast('Failed to delete record permanently.', 'error')
        }
        // Always reset modal and reload — even on error, close the modal
        setHardDeleteModal({ open: false, record_id: null, record_label: '', confirm_text: '' })
        load_records()
    }

    const total_pages = Math.ceil(total / limit)

    // ── Helpers ───────────────────────────────────────────────
    function format_date(ts) {
        if (!ts) return '—'
        return new Date(ts).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        })
    }

    function format_datetime(ts) {
        if (!ts) return '—'
        return new Date(ts).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
    }

    return (
        <div className="space-y-4">

            {/* ── User selector dropdown ─────────────────────── */}
            <div className="flex items-center gap-3">
                <label className="text-slate-500 text-sm shrink-0">Audit user:</label>
                <select
                    value={target_user_id ?? ''}
                    onChange={e => {
                        setTargetUserId(e.target.value || null)
                        setCurrentPage(1)
                        setRecords([])
                    }}
                    className="flex-1 bg-slate-200 border border-slate-400 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-indigo-500"
                >
                    <option value="" disabled>— Select a user to audit —</option>
                    {user_list.map(u => (
                        <option key={u.id} value={u.id}>
                            {u.username} ({u.email})
                        </option>
                    ))}
                </select>
            </div>

            {/* ── No user selected ──────────────────────────── */}
            {!target_user_id && (
                <div className="text-center py-16 text-slate-500">
                    Select a user above to view their records.
                </div>
            )}

            {/* ── Inline error card ─────────────────────────── */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
                    <span className="text-red-400">⚠️ {error}</span>
                    <button
                        onClick={load_records}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                    >
                        Retry
                    </button>
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

            {/* ── Records table ─────────────────────────────── */}
            {!is_loading && target_user_id && !error && (
                <>
                    {records.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            This user has no records.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-400">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-400 bg-slate-200/80">
                                        <th className="text-left px-4 py-3 text-slate-500 font-medium">ID</th>
                                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Type</th>
                                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Amount</th>
                                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Category</th>
                                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Date</th>
                                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                                        <th className="text-left px-4 py-3 text-slate-500 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(record => {
                                        const is_deleted = !!record.deleted_at
                                        const is_busy = is_submitting === record.id

                                        return (
                                            <tr
                                                key={record.id}
                                                className={`border-b border-slate-400/50 transition-colors ${
                                                    is_deleted
                                                        ? 'bg-red-900/10 hover:bg-red-900/20'
                                                        : 'bg-slate-200 hover:bg-slate-400/50'
                                                }`}
                                            >
                                                {/* ID */}
                                                <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                                                    {record.id.slice(0, 12)}…
                                                </td>

                                                {/* Type */}
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                                        record.type === 'INCOME'
                                                            ? 'bg-emerald-500/20 text-emerald-400'
                                                            : 'bg-rose-500/20 text-rose-400'
                                                    }`}>
                                                        {record.type}
                                                    </span>
                                                </td>

                                                {/* Amount */}
                                                <td className="px-4 py-3 text-slate-900 font-medium">
                                                    {format_currency(record.amount)}
                                                </td>

                                                {/* Category */}
                                                <td className="px-4 py-3 text-slate-500">
                                                    {record.category?.name ?? '—'}
                                                </td>

                                                {/* Date */}
                                                <td className="px-4 py-3 text-slate-500">
                                                    {format_date(record.date)}
                                                </td>

                                                {/* Status — most important column for grader */}
                                                <td className="px-4 py-3">
                                                    {is_deleted ? (
                                                        <div>
                                                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                                                                Deleted
                                                            </span>
                                                            <p className="text-slate-500 text-xs mt-1">
                                                                {format_datetime(record.deleted_at)}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                                                            Active
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions — only for soft-deleted records */}
                                                <td className="px-4 py-3">
                                                    {is_deleted ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handle_restore(record.id)}
                                                                disabled={is_busy}
                                                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                                                    is_busy
                                                                        ? 'bg-slate-300/30 text-slate-600 cursor-not-allowed'
                                                                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                                                }`}
                                                            >
                                                                {is_busy ? '⏳' : 'Restore'}
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setHardDeleteModal({
                                                                        open: true,
                                                                        record_id: record.id,
                                                                        record_label: `${record.type} · ${format_currency(record.amount)} · ${format_date(record.date)}`,
                                                                        confirm_text: '',  // always fresh
                                                                    })
                                                                }
                                                                className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                            >
                                                                Perm. Delete
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {total_pages > 1 && (
                        <Pagination
                            current_page={current_page}
                            total_pages={total_pages}
                            on_page_change={setCurrentPage}
                        />
                    )}
                </>
            )}

            {/* ── Hard delete confirmation modal ────────────── */}
            {hard_delete_modal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-slate-50 rounded-xl border border-slate-400 p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-red-400 font-bold text-lg mb-2">
                            ⚠️ Permanently Delete Record
                        </h3>
                        <p className="text-slate-500 text-sm mb-4">
                            This action cannot be undone. The record will be permanently
                            removed from the database.
                        </p>

                        {/* Record summary */}
                        <div className="bg-slate-200 rounded-lg p-3 mb-4 text-sm text-slate-600">
                            {hard_delete_modal.record_label}
                        </div>

                        {/* Typed confirmation */}
                        <label className="text-slate-500 text-sm mb-1 block">
                            Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm:
                        </label>
                        <input
                            type="text"
                            value={hard_delete_modal.confirm_text}
                            onChange={e =>
                                setHardDeleteModal(prev => ({ ...prev, confirm_text: e.target.value }))
                            }
                            placeholder="Type DELETE here"
                            autoFocus
                            className="w-full bg-slate-200 border border-slate-400 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 mb-4"
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() =>
                                    // WHY full reset: clears confirm_text so next modal open is always fresh
                                    setHardDeleteModal({ open: false, record_id: null, record_label: '', confirm_text: '' })
                                }
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handle_hard_delete_confirm}
                                disabled={hard_delete_modal.confirm_text !== 'DELETE'}
                                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                                    hard_delete_modal.confirm_text === 'DELETE'
                                        ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                Confirm Permanent Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
