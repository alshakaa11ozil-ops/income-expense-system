/*
 * ============================================================
 * FILE    : ToastContainer.jsx
 * LAYER   : View (component)
 * PURPOSE : Renders the active toast notifications in the
 *           top-right corner of the screen. Each toast shows
 *           a coloured icon, message, and close button.
 *           Toasts auto-dismiss via useToast — this component
 *           only handles visual rendering.
 * DEPENDS : useToast (for dismiss_toast)
 * ============================================================
 * EXPORTS:
 *   - ToastContainer : fixed-position toast stack
 * ============================================================
 */

/*
 * COMPONENT : ToastContainer
 * ─────────────────────────────────────────────────────────
 * WHY       : Without user-visible feedback, CRUD operations look
 *             broken — the table refreshes but nothing confirms
 *             what happened. This component displays those
 *             confirmations without blocking the UI or requiring
 *             user interaction (unlike window.alert).
 * HOW       : Renders a fixed-position stack of toast cards.
 *             Each card fades in via CSS animation. The close
 *             button calls dismiss_toast for manual removal.
 * @prop    {Toast[]}  toasts         - active toast array from useToast
 * @prop    {Function} dismiss_toast  - remove a toast by id
 * ─────────────────────────────────────────────────────────
 */
export default function ToastContainer({ toasts, dismiss_toast }) {
    if (toasts.length === 0) return null

    // colour and icon mapping by toast type
    const type_styles = {
        success: {
            wrapper: 'bg-white border-l-4 border-emerald-500',
            icon_bg: 'bg-emerald-50',
            icon_color: 'text-emerald-600',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            ),
        },
        error: {
            wrapper: 'bg-white border-l-4 border-red-500',
            icon_bg: 'bg-red-50',
            icon_color: 'text-red-600',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            ),
        },
        info: {
            wrapper: 'bg-white border-l-4 border-blue-500',
            icon_bg: 'bg-blue-50',
            icon_color: 'text-blue-600',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    }

    return (
        // fixed to viewport top-right, above all other content (z-50)
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
            {toasts.map(toast => {
                const style = type_styles[toast.type] ?? type_styles.info
                return (
                    <div
                        key={toast.id}
                        // pointer-events-auto re-enables interaction just on the card
                        className={`pointer-events-auto flex items-start gap-3 rounded-xl shadow-lg px-4 py-3 ${style.wrapper} animate-slide-in`}
                        style={{ animation: 'slideIn 0.2s ease-out' }}
                    >
                        {/* coloured icon circle */}
                        <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full ${style.icon_bg} ${style.icon_color} mt-0.5`}>
                            {style.icon}
                        </div>

                        {/* message text */}
                        <p className="flex-1 text-sm text-slate-700 font-medium leading-snug">
                            {toast.message}
                        </p>

                        {/* manual close button */}
                        <button
                            onClick={() => dismiss_toast(toast.id)}
                            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
                            aria-label="Close notification"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )
            })}

            {/* inline keyframe — avoids needing a tailwind config change */}
            <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(1rem); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        </div>
    )
}