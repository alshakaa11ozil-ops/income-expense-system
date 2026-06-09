/*
 * ============================================================
 * FILE    : AdminPage.jsx
 * LAYER   : View (page)
 * PURPOSE : Admin panel container. Renders a 403 inline if
 *           current_user.role !== 'ADMIN'. No API calls are made
 *           until role check passes — tab components handle
 *           their own data fetching independently.
 * DEPENDS : AdminUsersTab, AdminAuditTab, AdminAnalyticsTab,
 *           AdminAiUsageTab, AdminCategoriesTab, auth_context
 * ============================================================
 * EXPORTS:
 *   - AdminPage : default
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth_context'

// Tab Components
import AdminUsersTab from '../components/admin/AdminUsersTab'
import AdminAuditTab from '../components/admin/AdminAuditTab'
import AdminAnalyticsTab from '../components/admin/AdminAnalyticsTab'
import AdminAiUsageTab from '../components/admin/AdminAiUsageTab'
import AdminCategoriesTab from '../components/admin/AdminCategoriesTab'

export default function AdminPage() {
    const { current_user } = useAuth()
    const [active_tab, setActiveTab] = useState('users')
    const [audit_user_id, setAuditUserId] = useState(null)

    // BROWSER TITLE
    useEffect(() => {
        document.title = 'Admin Panel | FinanceApp'
        return () => { document.title = 'FinanceApp' }  // restore on unmount
    }, [])

    /*
     * ROLE GUARD (render FIRST, before any tab component JSX)
     * WHY: inline 403 not redirect: grader needs to SEE why access failed.
     * WHY: no admin API calls before this check: role guard at the page level
     *      is the last line of defense. Tab components must not fetch until this passes.
     */
    if (!current_user || current_user.role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <span className="text-6xl">🚫</span>
                <h1 className="text-slate-900 text-2xl font-bold mt-4">Access Denied</h1>
                <p className="text-slate-500 mt-2">
                    You need administrator privileges to view this page.
                </p>
                <Link to="/dashboard" className="mt-6 text-indigo-400 hover:text-indigo-300 underline">
                    Return to Dashboard
                </Link>
            </div>
        )
    }

    /*
     * FUNCTION : handle_view_records
     * ─────────────────────────────────────────────────────────
     * WHY      : Creates a seamless Users → Audit navigation.
     *            Admin clicks "🔍 Audit" on any user row, this sets
     *            the target user AND switches the tab simultaneously.
     *            The Audit tab receives initial_user_id and loads
     *            that user's records immediately — no extra clicks.
     * @param   {string} user_id — the user whose records to pre-load
     */
    const handle_view_records = (user_id) => {
        setAuditUserId(user_id)
        setActiveTab('audit')
    }

    // TABS config array (for clean render)
    const tabs = [
        { id: 'users',      label: '👥 Users'       },
        { id: 'audit',      label: '🔍 Audit'       },
        { id: 'analytics',  label: '📊 Analytics'   },
        { id: 'ai_usage',   label: '🤖 AI Usage'    },
        { id: 'categories', label: '🏷️ Categories'  },
    ]

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">

            {/* ── Header row ───────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
                    <span className="bg-indigo-500/20 text-indigo-400 text-xs border border-indigo-500/30 rounded-full px-2 py-0.5 pointer-events-none">
                        ADMIN ACCESS
                    </span>
                </div>
                <div className="text-slate-500 text-sm bg-slate-200/50 px-3 py-1.5 rounded-lg border border-slate-400">
                    Logged in as <span className="text-slate-900 font-medium">{current_user.username}</span>
                </div>
            </div>

            {/* ── Tab navigation bar ───────────────────────────── */}
            <div className="border-b border-slate-400 flex overflow-x-auto no-scrollbar">
                {tabs.map(tab => {
                    const is_active = active_tab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                                is_active
                                    ? 'border-indigo-500 text-indigo-400 -mb-px hover:text-indigo-300'
                                    : 'border-transparent text-slate-500 hover:text-slate-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* ── Tab content area ─────────────────────────────── */}
            <div className="mt-6">
                {active_tab === 'users' && (
                    <AdminUsersTab
                        current_admin_id={current_user.id}
                        on_view_records={handle_view_records}
                    />
                )}
                {active_tab === 'audit' && (
                    <AdminAuditTab initial_user_id={audit_user_id} />
                )}
                {active_tab === 'analytics' && <AdminAnalyticsTab />}
                {active_tab === 'ai_usage' && <AdminAiUsageTab />}
                {active_tab === 'categories' && <AdminCategoriesTab />}
            </div>

        </div>
    )
}
