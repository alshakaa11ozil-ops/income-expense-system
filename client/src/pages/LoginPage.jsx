/*
 * ============================================================
 * FILE    : LoginPage.jsx
 * LAYER   : View (page)
 * PURPOSE : Email + password login form. On success redirects to
 *           /dashboard. Displays field-level errors from the API
 *           (never alert popups). Shows a one-time success banner
 *           when the user arrives from /register via ?registered=true.
 *           Redirects to /dashboard if already authenticated.
 * DEPENDS : react, react-router-dom, ../context/auth_context
 * ============================================================
 * EXPORTS:
 *   - LoginPage (default)
 * ============================================================
 */

import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth_context'

/*
 * COMPONENT : LoginPage
 * ─────────────────────────────────────────────────────────────
 * WHY      : Entry point for all returning users. Sends credentials
 *            to the backend, stores the returned access token in
 *            AuthContext state, and navigates to the dashboard.
 *
 * HOW      : 1. If already authenticated, redirect to /dashboard
 *            2. Read ?registered=true param — show success banner
 *            3. Render email + password form
 *            4. On submit: client-validate → call login_user from
 *               context → navigate on success → map errors to fields
 * ─────────────────────────────────────────────────────────────
 */
function LoginPage() {
  const { access_token, login_user } = useAuth()
  const navigate = useNavigate()
  const [search_params] = useSearchParams()

  /*
   * WHY check ?registered=true:
   *   RegisterPage redirects to /login?registered=true on success.
   *   The banner appears once on that redirect. If the user navigates
   *   to /login directly (no param), no banner is shown. This is
   *   intentional — the banner is a one-time post-registration
   *   confirmation, not persisted state.
   */
  const just_registered = search_params.get('registered') === 'true'

  // ─── State ──────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show_password, setShowPassword] = useState(false)
  const [is_submitting, setIsSubmitting] = useState(false)
  /*
   * WHY errors is an object not a string:
   *   { email: '...', password: '...', general: '...' }
   *   Lets us display each error directly under its field.
   *   A generic string banner cannot tell the user which field
   *   is wrong or where to focus to fix it.
   */
  const [errors, setErrors] = useState({})

  // ─── Redirect if already logged in ──────────────────────────
  /*
   * WHY: A logged-in user navigating to /login would see a
   *      confusing empty form. Redirect them to the dashboard.
   *      Must run before the form renders, not in a useEffect,
   *      so there is no flash of the login form first.
   */
  if (access_token) {
    return <Navigate to="/records" replace />
  }

  // ─── Client-side validation ──────────────────────────────────
  /*
   * FUNCTION : validate_form
   * ─────────────────────────────────────────────────────────────
   * WHY      : Prevents obvious invalid submissions from making
   *            an API round-trip. The backend is still the source
   *            of truth — this is a convenience, not a security layer.
   *
   * HOW      : Check required fields, return error object.
   *            Empty object = valid.
   *
   * @returns {{ email?: string, password?: string }}
   * ─────────────────────────────────────────────────────────────
   */
  function validate_form() {
    const field_errors = {}
    if (!email.trim()) {
      field_errors.email = 'Email is required'
    } else if (!email.includes('@')) {
      field_errors.email = 'Enter a valid email address'
    }
    if (!password) {
      field_errors.password = 'Password is required'
    }
    return field_errors
  }

  // ─── Submit handler ──────────────────────────────────────────
  /*
   * FUNCTION : handle_submit
   * ─────────────────────────────────────────────────────────────
   * WHY      : Handles the full login flow: prevent default,
   *            validate, call context login, map API errors to
   *            the correct fields.
   *
   * HOW      : 1. e.preventDefault() — stop page reload
   *            2. Run client validation — bail if errors
   *            3. setIsSubmitting(true) — disable form
   *            4. Call login_user() from AuthContext
   *            5. On success: navigate to /dashboard
   *            6. On API error: map status → field error
   *            7. Finally: setIsSubmitting(false)
   *
   * @param   {React.FormEvent} e
   * ─────────────────────────────────────────────────────────────
   */
  async function handle_submit(e) {
    e.preventDefault()
    setErrors({})

    const field_errors = validate_form()
    if (Object.keys(field_errors).length > 0) {
      setErrors(field_errors)
      return
    }

    setIsSubmitting(true)
    try {
      await login_user(email, password)
      navigate('/records')
    } catch (err) {
      const status = err?.response?.status
      const message = err?.response?.data?.error

      if (status === 401) {
        /*
         * WHY not "wrong password" specifically:
         *   Telling an attacker which field is wrong helps them
         *   enumerate valid email addresses. A generic message
         *   on the password field is the safe convention.
         */
        setErrors({ password: 'Incorrect email or password' })
      } else if (status === 403) {
        setErrors({ email: 'This account has been deactivated. Contact support.' })
      } else if (status === 400 && message) {
        setErrors({ general: message })
      } else if (!err?.response) {
        // Network error — no response object means the server was unreachable.
        setErrors({ general: 'Cannot reach the server. Check your connection and try again.' })
      } else {
        setErrors({ general: 'An unexpected error occurred. Please try again.' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-8 py-10">

          {/* Logo / app name */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
              {/* Simple chart icon built from divs — no external icon deps needed */}
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">FinTrack</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to your account</p>
          </div>

          {/* Post-registration success banner */}
          {just_registered && (
            <div className="mb-6 flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
              <svg className="w-5 h-5 mt-0.5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Account created successfully! Please sign in.</span>
            </div>
          )}

          {/* General error banner */}
          {errors.general && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
              <svg className="w-5 h-5 mt-0.5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errors.general}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handle_submit} noValidate className="space-y-5">

            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={is_submitting}
                className={`
                  w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900
                  placeholder:text-slate-400 bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-slate-50 disabled:text-slate-400 transition-colors
                  ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-300'}
                `}
                placeholder="you@example.com"
              />
              {/* Field-level error — shown directly under the field */}
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show_password ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={is_submitting}
                  className={`
                    w-full px-3.5 py-2.5 pr-11 rounded-lg border text-sm text-slate-900
                    placeholder:text-slate-400 bg-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    disabled:bg-slate-50 disabled:text-slate-400 transition-colors
                    ${errors.password ? 'border-red-400 bg-red-50' : 'border-slate-300'}
                  `}
                  placeholder="••••••••"
                />
                {/*
                 * WHY show/hide toggle:
                 *   Passwords entered in a financial app are often
                 *   complex. Users need to verify what they typed.
                 *   type=password masks the field; the toggle reveals it.
                 */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={show_password ? 'Hide password' : 'Show password'}
                >
                  {show_password ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={is_submitting}
              className="
                w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 active:bg-blue-800
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center gap-2
              "
            >
              {is_submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>

          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage