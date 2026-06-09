/*
 * ============================================================
 * FILE    : AdminCategoriesTab.jsx
 * LAYER   : View (component)
 * PURPOSE : Tab 5 — System category management. Admin adds,
 *           edits, activates, and deactivates system categories.
 *           Personal user categories are NOT shown here.
 * DEPENDS : admin_get_categories, admin_create_category,
 *           admin_update_category, admin_deactivate_category, useToast
 * ============================================================
 * EXPORTS:
 *   - AdminCategoriesTab : main component
 * ============================================================
 */

import { useState, useEffect } from 'react'
import {
    admin_get_categories,
    admin_create_category,
    admin_update_category,
    admin_deactivate_category,
} from '../../services/api'
import { useToast } from '../layout/useToast'

/*
 * COMPONENT : AdminCategoriesTab
 * ─────────────────────────────────────────────────────────
 * WHY SEPARATE FROM /categories page:
 *   /categories = user manages THEIR OWN personal categories
 *   This tab = admin manages SYSTEM categories (user_id = null in DB)
 *   Different permissions, different data source, different operations.
 */
export default function AdminCategoriesTab() {
    const [categories, setCategories] = useState([])
    const [is_loading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    // WHY tracks category_id: prevents double-click on row buttons
    const [is_submitting, setIsSubmitting] = useState(null)

    const [edit_modal, setEditModal] = useState({
        open: false, cat: null, name: '', icon: '', color: ''
    })
    const [add_modal, setAddModal] = useState({
        open: false, name: '', icon: '📁', color: '#6B7280'
    })
    const [deactivate_confirm, setDeactivateConfirm] = useState({
        open: false, cat: null
    })

    const { show_toast } = useToast()

    async function load_categories() {
        setIsLoading(true)
        setError(null)
        try {
            const data = await admin_get_categories()
            setCategories(data)
        } catch {
            setError('Failed to load categories.')
            show_toast('Failed to load categories.', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load_categories()
    }, [])

    const active_count = categories.filter(c => c.is_active).length
    const inactive_count = categories.filter(c => !c.is_active).length

    /*
     * FUNCTION : handle_add
     * WHY      : Creates new system-wide category.
     */
    async function handle_add(e) {
        e.preventDefault()
        try {
            await admin_create_category(add_modal.name, add_modal.icon, add_modal.color)
            show_toast('System category created.', 'success')
            setAddModal({ open: false, name: '', icon: '📁', color: '#6B7280' })
            load_categories()
        } catch {
            show_toast('Failed to create category.', 'error')
        }
    }

    /*
     * FUNCTION : handle_edit
     * WHY      : Updates existing system category.
     */
    async function handle_edit(e) {
        e.preventDefault()
        try {
            await admin_update_category(edit_modal.cat.id, {
                name: edit_modal.name,
                icon: edit_modal.icon,
                color: edit_modal.color
            })
            show_toast('Category updated.', 'success')
            setEditModal({ open: false, cat: null, name: '', icon: '', color: '' })
            load_categories()
        } catch {
            show_toast('Failed to update category.', 'error')
        }
    }

    /*
     * FUNCTION : handle_deactivate
     * WHY      : Hides a category from the record dropdown. Soft-delete
     *            prevents breaking existing records that use this category.
     */
    async function handle_deactivate() {
        setIsSubmitting(deactivate_confirm.cat.id)
        try {
            await admin_deactivate_category(deactivate_confirm.cat.id)
            show_toast('Category deactivated.', 'success')
            load_categories()
        } catch {
            show_toast('Failed to deactivate category.', 'error')
        } finally {
            setIsSubmitting(null)
            setDeactivateConfirm({ open: false, cat: null })
        }
    }

    /*
     * FUNCTION : handle_activate
     * WHY      : Reactivates a deactivated category. Safe operation (no data risk),
     *            so no confirm modal is needed.
     */
    async function handle_activate(category_id) {
        setIsSubmitting(category_id)
        try {
            await admin_update_category(category_id, { is_active: true })
            show_toast('Category activated.', 'success')
            load_categories()
        } catch {
            show_toast('Failed to activate category.', 'error')
        } finally {
            setIsSubmitting(null)
        }
    }

    if (error && !is_loading) {
        return (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 flex items-center justify-between">
                <span className="text-red-400">⚠️ {error}</span>
                <button
                    onClick={load_categories}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ── Toolbar ───────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">System Categories</h2>
                    {!is_loading && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-300 text-slate-500 text-xs">
                            {active_count} active, {inactive_count} inactive
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setAddModal({ ...add_modal, open: true })}
                    className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                >
                    <span>+</span> Add System Category
                </button>
            </div>

            {/* ── Loading skeleton ────────────────────────────── */}
            {is_loading && (
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 bg-slate-200 rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── Categories table ────────────────────────────── */}
            {!is_loading && categories.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-400">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-400 bg-slate-200/80">
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Icon</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Color</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Records</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => {
                                const is_busy = is_submitting === cat.id

                                return (
                                    <tr key={cat.id} className="border-b border-slate-400/50 bg-slate-200 hover:bg-slate-400/40 transition-colors">
                                        {/* Icon */}
                                        <td className="px-4 py-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                                 style={{ backgroundColor: `${cat.color}33` }}>
                                                {cat.icon}
                                            </div>
                                        </td>

                                        {/* Name */}
                                        <td className="px-4 py-3 text-slate-900 font-medium">
                                            {cat.name}
                                        </td>

                                        {/* Color */}
                                        <td className="px-4 py-3 pb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 rounded" style={{ backgroundColor: cat.color }} />
                                                <span className="text-slate-500 text-xs font-mono">{cat.color}</span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            {cat.is_active ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-300 text-slate-500">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>

                                        {/* Records count */}
                                        <td className="px-4 py-3 text-slate-500">
                                            {cat._count?.records ?? 0}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setEditModal({ open: true, cat, name: cat.name, icon: cat.icon, color: cat.color })}
                                                    className="px-2 py-1 text-xs rounded bg-slate-300 text-slate-600 hover:bg-slate-600 transition-colors"
                                                >
                                                    Edit
                                                </button>

                                                {cat.is_active ? (
                                                    <button
                                                        onClick={() => setDeactivateConfirm({ open: true, cat })}
                                                        disabled={is_busy}
                                                        className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    >
                                                        {is_busy ? '⏳' : 'Deactivate'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handle_activate(cat.id)}
                                                        disabled={is_busy}
                                                        className="px-2 py-1 text-xs rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                                    >
                                                        {is_busy ? '⏳' : 'Activate'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Empty state ─────────────────────────────────── */}
            {!is_loading && categories.length === 0 && (
                <div className="text-center py-16 text-slate-500 bg-slate-200 rounded-xl border border-slate-400 border-dashed">
                    No system categories found.
                </div>
            )}

            {/* ── Add Modal ───────────────────────────────────── */}
            {add_modal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <form onSubmit={handle_add} className="bg-slate-50 rounded-xl border border-slate-400 p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-slate-900 font-bold text-lg mb-4">Add System Category</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-500 text-sm mb-1">Name</label>
                                <input type="text" required value={add_modal.name} onChange={e => setAddModal({ ...add_modal, name: e.target.value })}
                                    className="w-full bg-slate-200 border border-slate-400 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-indigo-500" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-slate-500 text-sm mb-1">Icon (Emoji)</label>
                                    <input type="text" required maxLength={2} value={add_modal.icon} onChange={e => setAddModal({ ...add_modal, icon: e.target.value })}
                                        className="w-full bg-slate-200 border border-slate-400 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 text-center" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-slate-500 text-sm mb-1">Color</label>
                                    <div className="flex items-center gap-2 bg-slate-200 border border-slate-400 rounded-lg px-2 py-1.5 focus-within:border-indigo-500">
                                        <input type="color" value={add_modal.color} onChange={e => setAddModal({ ...add_modal, color: e.target.value })}
                                            className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                                        <span className="text-slate-500 text-xs uppercase">{add_modal.color}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={() => setAddModal({ open: false, name: '', icon: '📁', color: '#6B7280' })}
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">Add Category</button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Edit Modal ──────────────────────────────────── */}
            {edit_modal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <form onSubmit={handle_edit} className="bg-slate-50 rounded-xl border border-slate-400 p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-slate-900 font-bold text-lg mb-4">Edit Category</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-500 text-sm mb-1">Name</label>
                                <input type="text" required value={edit_modal.name} onChange={e => setEditModal({ ...edit_modal, name: e.target.value })}
                                    className="w-full bg-slate-200 border border-slate-400 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-indigo-500" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-slate-500 text-sm mb-1">Icon (Emoji)</label>
                                    <input type="text" required maxLength={2} value={edit_modal.icon} onChange={e => setEditModal({ ...edit_modal, icon: e.target.value })}
                                        className="w-full bg-slate-200 border border-slate-400 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 text-center" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-slate-500 text-sm mb-1">Color</label>
                                    <div className="flex items-center gap-2 bg-slate-200 border border-slate-400 rounded-lg px-2 py-1.5 focus-within:border-indigo-500">
                                        <input type="color" value={edit_modal.color} onChange={e => setEditModal({ ...edit_modal, color: e.target.value })}
                                            className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" />
                                        <span className="text-slate-500 text-xs uppercase">{edit_modal.color}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={() => setEditModal({ open: false, cat: null, name: '', icon: '', color: '' })}
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">Save Changes</button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Deactivate Confirm Modal ────────────────────── */}
            {deactivate_confirm.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-slate-50 rounded-xl border border-slate-400 p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-slate-900 font-bold text-lg mb-2">Deactivate '{deactivate_confirm.cat?.name}'?</h3>
                        {deactivate_confirm.cat?._count?.records > 0 ? (
                            <p className="text-slate-500 text-sm mb-6 bg-amber-500/10 border border-amber-500/20 p-3 rounded text-amber-500">
                                ⚠️ This category is used by <b>{deactivate_confirm.cat._count.records}</b> records. Deactivating will hide it from the record form but will not affect existing records.
                            </p>
                        ) : (
                            <p className="text-slate-500 text-sm mb-6">
                                This category has no records. It will be hidden from the record form dropdown.
                            </p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeactivateConfirm({ open: false, cat: null })}
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">Cancel</button>
                            <button onClick={handle_deactivate}
                                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Deactivate</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
