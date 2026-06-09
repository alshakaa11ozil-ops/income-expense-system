/*
 * ============================================================
 * FILE    : ProtectedRoute.jsx
 * LAYER   : View (layout component)
 * PURPOSE : Guards every authenticated route. Shows a full-screen
 *           spinner while the session-restore check runs on app
 *           load, redirects to /login if unauthenticated, and
 *           renders children when a valid session exists.
 * DEPENDS : react-router-dom (Navigate), ../context/auth_context
 * ============================================================
 * EXPORTS:
 *   - ProtectedRoute : wraps authenticated page routes in App.jsx
 * ============================================================
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/auth_context'

/*
 * COMPONENT : ProtectedRoute
 * ─────────────────────────────────────────────────────────────
 * WHY      : React Router v6 has no built-in protected route.
 *            Every page that requires authentication must be
 *            wrapped with this component. Public pages (/login,
 *            /register) are NOT wrapped.
 *
 * HOW      : 1. Read { is_loading, access_token } from useAuth()
 *            2. is_loading = true  → render full-screen spinner
 *               WHY: the session-restore effect in AuthProvider
 *               runs async on mount (~200ms). Without this guard,
 *               the app would flash the login page for every
 *               authenticated user on every page load.
 *            3. access_token = null → <Navigate to="/login" replace />
 *               WHY replace: removes the protected route from the
 *               browser history so the back button does not return
 *               the user to a page they were just ejected from.
 *            4. access_token present → render children
 *
 * @param   {ReactNode} children - the page component to protect
 * ─────────────────────────────────────────────────────────────
 */
function ProtectedRoute({ children }) {
  const { is_loading, access_token } = useAuth()

  // Show spinner while the session-restore async check is in flight.
  // This prevents the login-page flash for already-authenticated users.
  if (is_loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    )
  }

  // No valid session — redirect to login.
  // `replace` prevents the protected page from sitting in history.
  if (!access_token) {
    return <Navigate to="/login" replace />
  }

  // Authenticated — render the protected page.
  return children
}

export default ProtectedRoute