/*
 * ============================================================
 * FILE    : useToast.js
 * LAYER   : View (custom hook)
 * PURPOSE : Provides a lightweight toast notification system.
 *           After CRUD operations the UI must give the user
 *           feedback — silent table refreshes look like bugs.
 *           This hook manages a list of active toasts and
 *           returns a function to trigger them.
 * DEPENDS : react (useState, useCallback, useRef)
 * ============================================================
 * EXPORTS:
 *   - useToast : returns { toasts, show_toast }
 * ============================================================
 */

import { useState, useCallback, useRef } from 'react'

/*
 * FUNCTION : useToast
 * ─────────────────────────────────────────────────────────
 * WHY      : CRUD operations (add, edit, delete, export) complete
 *            silently — the table refreshes but nothing tells the
 *            user "Record added successfully." Toasts fill this gap.
 *            Keeping the logic in a hook means RecordsPage just
 *            calls show_toast('...') and renders <ToastContainer />.
 *            No prop drilling, no global store needed.
 * HOW      : 1. Maintain an array of { id, message, type } toasts
 *            2. show_toast adds an entry with a unique id
 *            3. A setTimeout auto-removes it after `duration` ms
 *            4. dismiss_toast removes by id (for manual close)
 * @returns {{ toasts: Toast[], show_toast: Function }}
 * ─────────────────────────────────────────────────────────
 */
export function useToast() {
    const [toasts, setToasts] = useState([])

    // use a ref for the counter so it never causes re-renders
    const counter_ref = useRef(0)

    /*
     * FUNCTION : show_toast
     * WHY      : Called after every CRUD operation to give the user
     *            immediate, unambiguous confirmation of what happened.
     * @param   {string} message  - human-readable result text
     * @param   {string} type     - 'success' | 'error' | 'info'
     * @param   {number} duration - ms before auto-dismiss (default 3500)
     */
    const show_toast = useCallback((message, type = 'success', duration = 3500) => {
        const id = ++counter_ref.current

        setToasts(prev => [...prev, { id, message, type }])

        // auto-remove after duration — user never has to manually close
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])

    /*
     * FUNCTION : dismiss_toast
     * WHY      : Users may want to manually close a toast before it
     *            auto-dismisses (e.g. if they want to read a long error).
     * @param   {number} id - toast id to remove
     */
    const dismiss_toast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return { toasts, show_toast, dismiss_toast }
}