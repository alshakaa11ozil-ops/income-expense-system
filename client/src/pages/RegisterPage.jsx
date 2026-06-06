/*
 * ============================================================
 * FILE    : RegisterPage.jsx
 * LAYER   : View (page)
 * PURPOSE : New account registration form. On success redirects to
 *           /login?registered=true so the user sees a one-time
 *           success banner. Deliberately does NOT auto-login.
 *           register_user is imported directly from api.js (not
 *           AuthContext) because registration does not change auth
 *           state. See auth_context.jsx for the full rationale.
 * DEPENDS : react, react-router-dom, ../services/api (register_user)
 * ============================================================
 * EXPORTS:
 *   - RegisterPage (default)
 * ============================================================
 */

import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth_context'
import { register_user } from '../services/api'

/*
 * COMPONENT : RegisterPage
 * ─────────────────────────────────────────────────────────────
 * WHY      : Allows new users to create an account. Kept separate
 *            from the login flow so registration complexity
 *            (confirm password, strength bar, username) does not
 *            clutter LoginPage.
 *
 * HOW      : 1. If already authenticated, redirect to /dashboard
 *            2. Render username, email, password, confirm fields
 *            3. Show live password strength bar on keystroke
 *            4. On submit: client-validate → call register_user
 *               from api.js directly → navigate to /login?registered=true
 * ─────────────────────────────────────────────────────────────
 */
function RegisterPage() {
  const { access_token } = useAuth()
  const navigate = useNavigate()

  // ─── State ──────────────────────────────────────────────────
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm_password, setConfirmPassword] = useState('')
  const [show_password, setShowPassword] = useState(false)
  /*
   * WHY password_strength as 0–3 integer:
   *   Drives the colour and label of the strength bar without
   *   storing separate boolean flags for each condition.
   *   0 = no bar shown (empty field)
   *   1 = red  "Weak"
   *   2 = amber "Fair"
   *   3 = green "Strong"
   */
  const [password_strength, setPasswordStrength] = useState(0)
  const [is_submitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  // ─── Redirect if already logged in ──────────────────────────
  if (access_token) {
    return <Navigate to="/dashboard" replace />
  }

  // ─── Password strength calculation ──────────────────────────
  /*
   * WHY useEffect on password:
   *   Runs the strength check on every keystroke without
   *   blocking the input. Pure frontend — no API call.
   *   This is a UX nudge, not a security enforcement layer
   *   (the backend enforces the minimum 8-char rule).
   */
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0)
      return
    }
    let score = 0
    if (password.length >= 8) score += 1  // meets minimum length
    if (/[0-9]/.test(password)) score += 1  // contains a digit
    if (/[!@#$%^&*]/.test(password)) score += 1  // contains special char
    setPasswordStrength(score)
  }, [password])

  // ─── Strength bar config ─────────────────────────────────────
  const strength_config = {
    0: { label: '', width: 'w-0', color: '' },
    1: { label: 'Weak', width: 'w-1/3', color: 'bg-red-500' },
    2: { label: 'Fair', width: 'w-2/3', color: 'bg-amber-500' },
    3: { label: 'Strong', width: 'w-full', color: 'bg-green-500' },
  }
  const strength = strength_config[password_strength]

  // ─── Client-side validation ──────────────────────────────────
  /*
   * FUNCTION : validate_form
   * ─────────────────────────────────────────────────────────────
   * WHY      : Catches obvious errors before hitting the API.
   *            Matches backend rules so feedback is consistent.
   *
   * @returns {{ username?, email?, password?, confirm_password? }}
   * ─────────────────────────────────────────────────────────────
   */
  function validate_form() {
    const field_errors = {}

    if (!username.trim()) {
      field_errors.username = 'Username is required'
    } else if (username.trim().length < 3) {
      field_errors.username = 'Username must be at least 3 characters'
    } else if (/\s/.test(username)) {
      field_errors.username = 'Username cannot contain spaces'
    }

    if (!email.trim()) {
      field_errors.email = 'Email is required'
    } else if (!email.includes('@')) {
      field_errors.email = 'Enter a valid email address'
    }

    if (!password) {
      field_errors.password = 'Password is required'
    } else if (password.length < 8) {
      field_errors.password = 'Password must be at least 8 characters'
    }

    if (!confirm_password) {
      field_errors.confirm_password = 'Please confirm your password'
    } else if (confirm_password !== password) {
      // WHY confirm check after password check:
      //   Only report mismatch if both fields are present and valid.
      //   Avoids two simultaneous errors for password issues.
      field_errors.confirm_password = 'Passwords do not match'
    }

    return field_errors
  }

  // ─── Submit handler ──────────────────────────────────────────
  /*
   * FUNCTION : handle_submit
   * ─────────────────────────────────────────────────────────────
   * WHY      : Orchestrates the registration flow.
   *
   * HOW      : 1. e.preventDefault()
   *            2. Run client validation — bail if errors
   *            3. setIsSubmitting(true)
   *            4. Call register_user() from api.js directly
   *               (NOT from AuthContext — see file header)
   *            5. On success: navigate to /login?registered=true
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
      await register_user(username.trim(), email.trim(), password)
      /*
       * WHY navigate to /login?registered=true instead of /dashboard:
       *   Registration does NOT log the user in — the server does not
       *   return a refresh token cookie on /register. The user must
       *   explicitly log in. The query param triggers a one-time
       *   success banner in LoginPage to confirm their account exists.
       */
      navigate('/login?registered=true')
    } catch (err) {
      const status = err?.response?.status
      const message = err?.response?.data?.error

      if (status === 409) {
        // Backend signals a duplicate email with 409 Conflict.
        setErrors({ email: 'An account with this email already exists' })
      } else if (status === 400 && message) {
        // Zod validation error from the backend — try to map to a field.
        const lower = message.toLowerCase()
        if (lower.includes('username')) {
          setErrors({ username: message })
        } else if (lower.includes('email')) {
          setErrors({ email: message })
        } else if (lower.includes('password')) {
          setErrors({ password: message })
        } else {
          setErrors({ general: message })
        }
      } else if (!err?.response) {
        setErrors({ general: 'Cannot reach the server. Check your connection and try again.' })
      } else {
        setErrors({ general: 'An unexpected error occurred. Please try again.' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Reusable field error element ────────────────────────────
  /*
   * FUNCTION : FieldError
   * WHY      : Avoids repeating the same error markup 4 times.
   *            Keeps the JSX readable and errors visually consistent.
   */
  function FieldError({ message }) {
    if (!message) return null
    return (
      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {message}
      </p>
    )
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
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
            <p className="text-sm text-slate-500 mt-1">Free to use. No credit card required.</p>
          </div>

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

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={is_submitting}
                className={`
                  w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900
                  placeholder:text-slate-400 bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-slate-50 disabled:text-slate-400 transition-colors
                  ${errors.username ? 'border-red-400 bg-red-50' : 'border-slate-300'}
                `}
                placeholder="jane_doe"
              />
              <FieldError message={errors.username} />
            </div>

            {/* Email */}
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
              <FieldError message={errors.email} />
            </div>

            {/* Password + strength bar */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show_password ? 'text' : 'password'}
                  autoComplete="new-password"
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
                  placeholder="Min. 8 characters"
                />
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

              {/* Password strength bar — only shown when password is non-empty */}
              {password && (
                <div className="mt-2">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.width} ${strength.color}`}
                    />
                  </div>
                  <p className={`text-xs mt-1 font-medium ${password_strength === 1 ? 'text-red-600' :
                      password_strength === 2 ? 'text-amber-600' :
                        'text-green-600'
                    }`}>
                    {strength.label}
                  </p>
                </div>
              )}

              <FieldError message={errors.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm_password"
                type={show_password ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm_password}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={is_submitting}
                className={`
                  w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900
                  placeholder:text-slate-400 bg-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  disabled:bg-slate-50 disabled:text-slate-400 transition-colors
                  ${errors.confirm_password ? 'border-red-400 bg-red-50' : 'border-slate-300'}
                `}
                placeholder="Repeat your password"
              />
              <FieldError message={errors.confirm_password} />
            </div>

            {/* Submit */}
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
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>

          </form>

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage