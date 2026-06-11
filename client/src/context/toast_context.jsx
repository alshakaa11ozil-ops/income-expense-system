/*
 * ============================================================
 * FILE    : toast_context.jsx
 * LAYER   : Context (global state)
 * PURPOSE : Single app-wide toast queue so show_toast works from
 *           any page or nested component. Renders ToastContainer
 *           once at the provider level.
 * DEPENDS : react, ../components/layout/ToastContainer
 * ============================================================
 * EXPORTS:
 *   - ToastProvider : wraps the app tree
 *   - useToast        : hook — show_toast / dismiss_toast
 * ============================================================
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import ToastContainer from '../components/layout/ToastContainer'

const ToastContext = createContext(null)

/*
 * COMPONENT : ToastProvider
 * ─────────────────────────────────────────────────────────
 * WHY      : useToast previously used local useState per component,
 *            so toasts only appeared when that component also
 *            rendered ToastContainer (only RecordsPage did).
 * HOW      : 1. Hold the toast queue in context
 *            2. Expose show_toast / dismiss_toast to descendants
 *            3. Render ToastContainer once here (fixed top-right)
 * ─────────────────────────────────────────────────────────
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const counter_ref = useRef(0)

    /*
     * FUNCTION : show_toast
     * WHY      : Called after CRUD and other important actions so
     *            feedback is visible regardless of which page mounted.
     */
    const show_toast = useCallback((message, type = 'success', duration = 3500) => {
        const id = ++counter_ref.current
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])

    const dismiss_toast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ show_toast, dismiss_toast }}>
            {children}
            <ToastContainer toasts={toasts} dismiss_toast={dismiss_toast} />
        </ToastContext.Provider>
    )
}

/*
 * FUNCTION : useToast
 * WHY      : Same API as before — components import from useToast.js
 *            which re-exports this hook.
 */
export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return ctx
}
