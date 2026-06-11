/*
 * ============================================================
 * FILE    : RecordForm.jsx
 * LAYER   : View (component)
 * PURPOSE : Dual-mode form for Add and Edit operations.
 *           The record ID field behaves differently between modes
 *           (auto-generated + editable in Add vs fixed in Edit).
 *           This is a direct teacher requirement for Q13.
 * DEPENDS : api.js (generate_record_id, create_record, update_record),
 *           auth_context (for operator default), react
 * ============================================================
 * EXPORTS:
 *   - RecordForm : add/edit form component
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../context/auth_context'
import { useToast } from '../layout/useToast'
import {
    generate_record_id,
    create_record,
    update_record,
} from '../../services/api'
import { parse_currency } from '../../utils/format_currency'

/*
 * COMPONENT : RecordForm
 * ─────────────────────────────────────────────────────────
 * WHY       : Teacher requires Add and Edit in one place because
 *             both share the same fields. The mode prop controls:
 *             - which API call is made (POST vs PUT)
 *             - how the ID field behaves (editable vs locked)
 *             - form title and submit button label
 *
 *             Keeping both modes in one component avoids duplicating
 *             the validation logic, field layout, and error handling.
 *
 * @prop    {string}     mode           - 'add' | 'edit'
 * @prop    {Record}     initial_data   - record to edit (edit mode only)
 * @prop    {Category[]} category_list  - loaded once by RecordsPage
 * @prop    {Function}   on_success()   - called after successful save
 * @prop    {Function}   on_close()     - closes the modal without saving
 * ─────────────────────────────────────────────────────────
 */
export default function RecordForm({
    mode = 'add',
    initial_data = null,
    category_list = [],
    on_success,
    on_close,
}) {
    const { current_user } = useAuth()
    const { show_toast } = useToast()

    const [form_data, setFormData] = useState({
        id: '',
        type: 'expense',
        amount: '',
        category_id: '',
        date: '',
        operator: '',
        notes: '',
    })
    const [errors, setErrors] = useState({})
    const [is_submitting, setIsSubmitting] = useState(false)
    const [is_generating_id, setIsGeneratingId] = useState(false)

    // ── Initialise form on open ────────────────────────────────

    /*
     * WHY two separate useEffect calls:
     *   Add mode: fetch a suggested ID from the backend, default
     *   date to today, prefill operator with current user's username.
     *   Edit mode: populate every field from initial_data.
     *   Combining them into one effect with mode as a dep causes
     *   the generate-id fetch to run on EVERY mode change.
     */

    useEffect(() => {
        if (mode !== 'add') return

        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

        setFormData({
            id: '',
            type: 'expense',
            amount: '',
            category_id: '',
            date: today,
            // WHY prefill operator: the current user is almost always
            // the operator. They can override it but this saves friction.
            operator: current_user?.username ?? '',
            notes: '',
        })

        // fetch suggested ID async — show spinner in the field
        setIsGeneratingId(true)
        generate_record_id()
            .then(suggested => {
                setFormData(prev => ({ ...prev, id: suggested }))
            })
            .catch(() => {
                // non-fatal — user can type their own ID
                setFormData(prev => ({ ...prev, id: '' }))
            })
            .finally(() => setIsGeneratingId(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode])

    useEffect(() => {
        if (mode !== 'edit' || !initial_data) return

        setFormData({
            id: initial_data.id,
            type: initial_data.type,
            amount: String(initial_data.amount),     // keep as string
            category_id: initial_data.category_id,
            // strip the time portion — <input type="date"> needs "YYYY-MM-DD"
            date: initial_data.date
                ? initial_data.date.split('T')[0]
                : '',
            operator: initial_data.operator ?? '',
            notes: initial_data.notes ?? '',
        })
        setErrors({})
    }, [mode, initial_data])

    // ── Field change handler ───────────────────────────────────

    /*
     * FUNCTION : handle_change
     * WHY      : Single handler for all fields reduces boilerplate.
     *            Clearing the error for the changed field gives
     *            instant feedback when the user corrects a mistake.
     */
    function handle_change(e) {
        const { name, value } = e.target
        let final_value = value
        
        if (name === 'amount') {
            final_value = parse_currency(value)
        }
        
        setFormData(prev => ({ ...prev, [name]: final_value }))
        // clear the specific field error so the user sees immediate feedback
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: undefined }))
        }
    }

    // ── Client-side validation ─────────────────────────────────

    /*
     * FUNCTION : validate_form
     * WHY      : Catching obvious errors before an API round-trip
     *            gives faster feedback and reduces unnecessary
     *            network requests. Backend validates again regardless —
     *            this is a UI convenience, not a security mechanism.
     * @returns {boolean} true if valid, false if errors found
     */
    function validate_form() {
        const new_errors = {}

        if (mode === 'add' && !form_data.id.trim()) {
            new_errors.id = 'Record ID is required'
        }

        if (!form_data.type) {
            new_errors.type = 'Type is required'
        }

        if (!form_data.amount.trim()) {
            new_errors.amount = 'Amount is required'
        } else if (!/^\d+(\.\d{1,2})?$/.test(form_data.amount.trim())) {
            // WHY regex: rejects "abc", "1.234" (3 dp), "1.2.3"
            new_errors.amount = 'Enter a valid amount (e.g. 100.00)'
        } else if (parseFloat(form_data.amount) <= 0) {
            // parseFloat here is validation only, not arithmetic
            new_errors.amount = 'Amount must be greater than 0'
        }

        if (!form_data.category_id) {
            new_errors.category_id = 'Please select a category'
        }

        if (!form_data.date) {
            new_errors.date = 'Date is required'
        }

        // operator is optional — skip validation

        setErrors(new_errors)
        return Object.keys(new_errors).length === 0
    }

    // ── Submit handler ─────────────────────────────────────────

    /*
     * FUNCTION : handle_submit
     * WHY      : Validates first, then calls the correct API function
     *            based on mode. On success, calls on_success() so the
     *            parent (RecordsPage) can close the modal and refresh
     *            the table. On error, maps HTTP status codes to
     *            specific field-level messages so the user knows
     *            exactly what to fix.
     */
    async function handle_submit(e) {
        e.preventDefault()
        if (!validate_form()) {
            show_toast('Please correct the highlighted errors.', 'error')
            return
        }

        setIsSubmitting(true)
        setErrors({})

        try {
            if (mode === 'add') {
                await create_record({ ...form_data })
            } else {
                // WHY destructure out id: the update payload must never
                // include the id field. Backend strips it too, but explicit
                // enforcement here makes the intent unambiguous.
                const { id: _id, ...payload_without_id } = form_data
                await update_record(initial_data.id, payload_without_id)
            }

            on_success()
        } catch (err) {
            const status = err?.response?.status
            const message = err?.response?.data?.error ?? 'Something went wrong'

            if (status === 409) {
                const id_msg = 'This Record ID already exists. Choose a different ID.'
                setErrors({ id: id_msg })
                show_toast(id_msg, 'error')
            } else if (status === 400) {
                setErrors({ general: message })
                show_toast(message, 'error')
            } else {
                setErrors({ general: message })
                show_toast(message, 'error')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── Render ─────────────────────────────────────────────────

    const is_edit = mode === 'edit'
    const title = is_edit ? 'Edit Record' : 'Add Record'

    return (
        <form onSubmit={handle_submit} noValidate className="space-y-4">

            {/* General error (non-field API errors) */}
            {errors.general && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {errors.general}
                </div>
            )}

            {/* ── Record ID ─────────────────────────────────────── */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-slate-700">
                        Record ID {!is_edit && <span className="text-red-500">*</span>}
                    </label>
                    {is_edit && (
                        // Fixed badge — visually signals the field cannot be changed
                        <span className="text-xs bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            Fixed
                        </span>
                    )}
                </div>

                <div className="relative">
                    <input
                        type="text"
                        name="id"
                        value={form_data.id}
                        onChange={is_edit ? undefined : handle_change}
                        placeholder={is_edit ? '' : 'e.g. REC-001'}
                        // EDIT MODE: both disabled AND readOnly
                        // disabled  → prevents user input, field excluded from form data
                        // readOnly  → semantic signal for assistive technologies
                        // Together they make the immutability unambiguous
                        disabled={is_edit || is_generating_id}
                        readOnly={is_edit}
                        className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors ${is_edit
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-slate-300'
                                : errors.id
                                    ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500 outline-none'
                                    : 'border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                            }`}
                    />
                    {/* spinner shown while fetching suggested ID */}
                    {is_generating_id && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="animate-spin w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Contextual hint text below the ID field */}
                {!is_edit && !errors.id && (
                    <p className="mt-1 text-xs text-slate-500">
                        Auto-generated — you can change this to any unique ID
                    </p>
                )}
                {is_edit && (
                    <p className="mt-1 text-xs text-slate-500">
                        Record ID cannot be changed after creation
                    </p>
                )}
                {errors.id && (
                    <p className="mt-1 text-xs text-red-600">{errors.id}</p>
                )}
            </div>

            {/* ── Type & Amount (side by side) ──────────────────── */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="type"
                        value={form_data.type}
                        onChange={handle_change}
                        className="w-full px-3 py-2 rounded-lg border border-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50"
                    >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>
                    {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Amount <span className="text-red-500">*</span>
                    </label>
                    {/*
            WHY type="text" + inputMode="decimal":
              type="number" adds spinner arrows (ugly on financial forms)
              and can silently round values with many decimal places.
              type="text" keeps the value as a string — no precision loss.
              inputMode="decimal" still shows a numeric keyboard on mobile.
          */}
                    <input
                        type="text"
                        inputMode="decimal"
                        name="amount"
                        value={form_data.amount}
                        onChange={handle_change}
                        placeholder="0.00"
                        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${errors.amount
                                ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
                                : 'border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                    />
                    {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
                </div>
            </div>

            {/* ── Category ──────────────────────────────────────── */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category <span className="text-red-500">*</span>
                </label>
                <select
                    name="category_id"
                    value={form_data.category_id}
                    onChange={handle_change}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors bg-slate-50 ${errors.category_id
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                >
                    <option value="">Select a category...</option>
                    {category_list.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                        </option>
                    ))}
                </select>
                {errors.category_id && (
                    <p className="mt-1 text-xs text-red-600">{errors.category_id}</p>
                )}
            </div>

            {/* ── Date ──────────────────────────────────────────── */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date <span className="text-red-500">*</span>
                </label>
                <input
                    type="date"
                    name="date"
                    value={form_data.date}
                    onChange={handle_change}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${errors.date
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                />
                {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
            </div>

            {/* ── Operator ──────────────────────────────────────── */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Operator <span className="text-slate-500 text-xs font-normal">(optional)</span>
                </label>
                {/*
          WHY pre-fill with current_user.username:
            The operator field records who entered the transaction.
            In almost all cases that is the logged-in user. Pre-filling
            reduces friction while still allowing override.
        */}
                <input
                    type="text"
                    name="operator"
                    value={form_data.operator}
                    onChange={handle_change}
                    placeholder="Who entered this record?"
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${errors.operator
                            ? 'border-red-300 bg-red-50'
                            : 'border-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                />
                {errors.operator && (
                    <p className="mt-1 text-xs text-red-600">{errors.operator}</p>
                )}
            </div>

            {/* ── Notes (optional) ──────────────────────────────── */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes <span className="text-slate-500 text-xs font-normal">(optional)</span>
                </label>
                <textarea
                    name="notes"
                    value={form_data.notes}
                    onChange={handle_change}
                    placeholder="Any additional details..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-400 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                />
            </div>

            {/* ── Action buttons ────────────────────────────────── */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                    type="button"
                    onClick={on_close}
                    disabled={is_submitting}
                    className="px-4 py-2 rounded-lg border border-slate-400 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={is_submitting}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                    {is_submitting && (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                    )}
                    {is_submitting
                        ? (is_edit ? 'Saving…' : 'Adding…')
                        : (is_edit ? 'Save Changes' : 'Add Record')}
                </button>
            </div>
        </form>
    )
}