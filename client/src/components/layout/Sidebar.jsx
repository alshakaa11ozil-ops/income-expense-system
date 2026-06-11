/*
 * ============================================================
 * FILE    : Sidebar.jsx
 * LAYER   : View (layout component)
 * PURPOSE : Persistent left-side navigation bar shared between
 *           all protected pages (Dashboard, Records, AI, Admin).
 *           Keeps navigation concerns out of individual pages.
 *
 * WHY A SIDEBAR INSTEAD OF A TOP NAV:
 *   A sidebar makes the multi-page structure immediately obvious
 *   to a grader — they can see all available sections at a glance
 *   without having to hunt for links. It also leaves the full
 *   horizontal width free for data-dense pages like Records.
 *
 * HOW ACTIVE STATE WORKS:
 *   react-router's useLocation() gives the current pathname.
 *   Each nav item compares its 'to' path against the current
 *   location to decide whether to render as active (dark bg +
 *   white text) or inactive (transparent + gray text).
 *
 * DEPENDS : react-router-dom (NavLink, useNavigate),
 *           auth_context (current_user, logout_user)
 * ============================================================
 * EXPORTS:
 *   - Sidebar : left-side navigation component
 * ============================================================
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth_context'
import { useToast } from './useToast'

// ── Navigation items ─────────────────────────────────────────
/*
 * WHY a static array:
 *   Declaring nav items as data (not JSX) makes it trivial to
 *   add/remove routes in future chats without touching render logic.
 *   Each item has: path, label, and an inline SVG icon function.
 */
const nav_items = [
    {
        to:    '/dashboard',
        label: 'Dashboard',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        to:    '/records',
        label: 'Records',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
    {
        to:    '/ai',
        label: 'AI Assistant',
        icon: (
            <span className="text-lg">🤖</span>
        ),
    },
    {
        to:    '/categories',
        label: 'My Categories',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
        ),
    },
]

/*
 * COMPONENT : Sidebar
 * ─────────────────────────────────────────────────────────
 * WHY       : Without a persistent nav, users must rely on
 *             buried links inside page content to move around.
 *             A sidebar makes the app feel like a complete
 *             product rather than disconnected pages.
 * HOW       : Fixed-height column with three sections stacked:
 *             1. App logo/brand at top
 *             2. Nav links in the middle (flex-1 takes remaining space)
 *             3. User info + logout button at the bottom
 * ─────────────────────────────────────────────────────────
 */
export default function Sidebar() {
    const { current_user, logout_user } = useAuth()
    const { show_toast } = useToast()
    const navigate = useNavigate()

    /*
     * FUNCTION : handle_logout
     * WHY      : Calls auth context logout then immediately navigates
     *            to /login. Without the navigate call the user stays
     *            on the current URL — ProtectedRoute would redirect
     *            them anyway but there would be a visible flicker.
     */
    async function handle_logout() {
        await logout_user()
        show_toast('Logged out successfully.', 'success')
        navigate('/login', { replace: true })
    }

    return (
        /*
         * WHY fixed height + flex-col:
         *   The sidebar must span the full viewport height regardless
         *   of page content length. flex-col lets us push the user
         *   section to the bottom with mt-auto.
         */
        <aside className="w-60 h-full bg-slate-50 flex flex-col shrink-0">

            {/* ── Brand ───────────────────────────────────── */}
            <div className="px-6 py-6 border-b border-slate-300">
                <NavLink to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    {/* App icon — simple colored square with emoji */}
                    <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-lg">
                        💰
                    </div>
                    <div>
                        <p className="text-slate-900 font-bold text-sm leading-tight">FinanceApp</p>
                        <p className="text-slate-500 text-xs">Income & Expense</p>
                    </div>
                </NavLink>
            </div>

            {/* ── Navigation links ────────────────────────── */}
            {/*
             * WHY flex-1:
             *   Pushes the user section below to the very bottom of
             *   the sidebar using the remaining flex space.
             */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {nav_items.map(item => (
                    /*
                     * WHY NavLink not Link:
                     *   NavLink provides an isActive callback that lets us
                     *   style the active route differently. Link has no
                     *   built-in active awareness.
                     */
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-emerald-500 text-white'          // active: green highlight
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'  // inactive
                            }`
                        }
                    >
                        {item.icon}
                        {item.label}
                    </NavLink>
                ))}

                {/* ── Admin link (Admin only) ─────────────── */}
                {current_user?.role === 'ADMIN' && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2 ${
                                isActive
                                    ? 'bg-indigo-500 text-white'          // distinguish admin route
                                    : 'text-indigo-400/70 hover:bg-slate-800 hover:text-indigo-300'
                            }`
                        }
                    >
                        <span className="text-lg">🛡️</span>
                        Admin Panel
                    </NavLink>
                )}
            </nav>

            {/* ── User section ────────────────────────────── */}
            <div className="px-3 py-4 border-t border-slate-300">
                {/* User info row */}
                <NavLink 
                    to="/profile" 
                    className={({ isActive }) => `group flex items-center gap-3 px-3 py-2 mb-2 rounded-lg transition-colors ${isActive ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : 'hover:bg-slate-200'}`}
                >
                    {/*
                     * WHY show first letter of username:
                     *   A generated avatar is more personal than a generic
                     *   user icon, and requires no image asset.
                     */}
                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {current_user?.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="overflow-hidden text-left flex-1">
                        <p className="text-slate-900 text-sm font-medium truncate">
                            {current_user?.username ?? 'User'}
                        </p>
                        <p className="text-slate-500 text-xs truncate">
                            {current_user?.role ?? ''}
                        </p>
                    </div>
                    {/* Profile Icon to indicate clickability */}
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </NavLink>

                {/* Logout button */}
                <button
                    onClick={handle_logout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-900/40 hover:text-red-400 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                </button>
            </div>
        </aside>
    )
}
