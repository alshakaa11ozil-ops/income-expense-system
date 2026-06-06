/*
 * ============================================================
 * FILE    : App.jsx
 * LAYER   : View (router root)
 * PURPOSE : Defines all client-side routes. Public routes
 *           (/login, /register) are open. Every other route is
 *           wrapped with ProtectedRoute which redirects to /login
 *           if there is no valid session.
 * DEPENDS : react-router-dom, auth pages, ProtectedRoute,
 *           RecordsPage (Chat 8)
 * ============================================================
 * EXPORTS:
 *   - App : root router component
 * ============================================================
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RecordsPage from './pages/RecordsPage'   // ← FIXED: was './pages/RegisterPage' (typo)
import ProtectedRoute from './components/layout/ProtectedRoute'
import { useAuth } from './context/auth_context'

// ─── Placeholder pages (replace in Chats 9–12) ───────────────

/*
 * COMPONENT : DashboardPage (stub)
 * WHY       : Gives ProtectedRoute a real destination so the
 *             login → redirect flow can be verified before the
 *             full dashboard is built in Chat 9.
 */
function DashboardPage() {
  const { current_user, logout_user } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Auth is working!</h1>
        <p className="text-sm text-slate-500">
          Signed in as <span className="font-medium text-slate-700">{current_user?.email}</span>
        </p>
        <p className="text-xs text-slate-400">
          Role: <span className="font-medium">{current_user?.role}</span>
        </p>
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          This stub will be replaced by the full Dashboard in Chat 9.
        </p>
        <button
          onClick={logout_user}
          className="mt-2 w-full py-2 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

// ─── App router ───────────────────────────────────────────────

/*
 * COMPONENT : App
 * WHY       : Single place where all routes are declared. Keeps
 *             routing concerns out of individual page components.
 *
 * Route strategy:
 *   /           → redirect to /records (most-used page)
 *   /login      → public
 *   /register   → public
 *   /dashboard  → protected stub (Chat 9)
 *   /records    → protected full page (Chat 8)
 *   *           → redirect to /records (404 fallback)
 */
function App() {
  return (
    <Routes>
      {/* Root → records */}
      <Route path="/" element={<Navigate to="/records" replace />} />

      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected: dashboard stub — replaced Chat 9 */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Protected: Records page — Chat 8 full implementation */}
      <Route
        path="/records"
        element={
          <ProtectedRoute>
            <RecordsPage />
          </ProtectedRoute>
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/records" replace />} />
    </Routes>
  )
}

export default App