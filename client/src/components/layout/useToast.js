/*
 * ============================================================
 * FILE    : useToast.js
 * LAYER   : View (custom hook re-export)
 * PURPOSE : Stable import path for the global toast hook.
 * DEPENDS : ../../context/toast_context
 * ============================================================
 * EXPORTS:
 *   - useToast      : returns { show_toast, dismiss_toast }
 *   - ToastProvider : app-wide toast provider (re-export)
 * ============================================================
 */

export { useToast, ToastProvider } from '../../context/toast_context'
