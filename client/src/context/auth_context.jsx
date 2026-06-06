/*
 * ============================================================
 * FILE    : auth_context.jsx
 * LAYER   : Context (global state)
 * PURPOSE : Provides authentication state and functions to the
 *           entire React tree. Owns access_token in memory (never
 *           localStorage), current_user, and the is_loading flag
 *           that prevents the login-page flash on app load.
 *           Coordinates with api.js via set_api_token and
 *           register_auth_callbacks.
 * DEPENDS : react, ../services/api.js
 * ============================================================
 * EXPORTS:
 *   - AuthProvider : wraps the app, provides context value
 *   - useAuth      : hook — returns the context value
 * ============================================================
 */

import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
    set_api_token,
    register_auth_callbacks,
    login_user,
    logout_user,
    refresh_token,
    get_current_user,
} from '../services/api'

const AuthContext = createContext(null)

/*
 * COMPONENT : AuthProvider
 * ─────────────────────────────────────────────────────────────
 * WHY      : Centralises all auth state so every component in the
 *            tree can access access_token and current_user without
 *            prop-drilling through 15+ components.
 *
 * HOW      : 1. Register api.js callbacks FIRST (useEffect #1,
 *               declared before the session-restore effect so React
 *               runs it first — effects run in declaration order).
 *            2. On mount, attempt to silently restore the session
 *               by calling refresh_token(). If it succeeds, fetch
 *               the current user profile and hydrate state.
 *            3. Expose state + functions via AuthContext.Provider.
 *
 * @param   {ReactNode} children
 * ─────────────────────────────────────────────────────────────
 */
export function AuthProvider({ children }) {
    const [access_token, setAccessToken] = useState(null)
    const [current_user, setCurrentUser] = useState(null)
    /*
     * WHY is_loading starts true:
     *   On every page load we immediately attempt to restore the
     *   session via the httpOnly cookie. While that check is in
     *   flight, is_loading = true tells ProtectedRoute to show a
     *   spinner instead of redirecting to /login. Without this,
     *   logged-in users see a 200ms flash of the login page.
     */
    const [is_loading, setIsLoading] = useState(true)

    // ─── Stable setter refs ──────────────────────────────────────
    /*
     * WHY useRef for setters:
     *   register_auth_callbacks stores closures in api.js module scope.
     *   If those closures captured setAccessToken directly, they would
     *   close over the initial (null) value. Using refs lets the
     *   closures always call the *current* setter via .current —
     *   React guarantees setState identity is stable across renders,
     *   so this is safe and avoids stale-closure bugs.
     */
    const set_access_token_ref = useRef(null)
    const set_current_user_ref = useRef(null)

    // Wire refs immediately after useState — no effect needed.
    set_access_token_ref.current = setAccessToken
    set_current_user_ref.current = setCurrentUser

    // ─── Effect #1: Register callbacks (declared FIRST) ──────────
    /*
     * WHY this effect is declared before the session-restore effect:
     *   React runs useEffect hooks in declaration order. By declaring
     *   callback registration first, we guarantee the callbacks exist
     *   in api.js module scope before the second effect fires and makes
     *   any HTTP requests. This closes the race condition where an early
     *   401 would call _on_logout before it was registered.
     */
    useEffect(() => {
        register_auth_callbacks({
            /*
             * on_token_refresh — called by the 401 interceptor after a
             * successful silent refresh mid-session. Updates React state
             * and the module-level store so the next request gets the
             * new token without the user ever knowing it happened.
             */
            on_token_refresh: (new_token) => {
                set_access_token_ref.current?.(new_token)
                set_api_token(new_token)
            },

            /*
             * on_logout — called by the 401 interceptor when the refresh
             * token itself has expired or been revoked. Clears all auth
             * state so ProtectedRoute redirects to /login automatically.
             */
            on_logout: () => {
                set_access_token_ref.current?.(null)
                set_current_user_ref.current?.(null)
                set_api_token(null)
                // ProtectedRoute detects access_token === null and redirects.
            },
        })
    }, []) // empty deps — register once, callbacks persist for app lifetime

    // ─── Effect #2: Silent session restore on app load ───────────
    /*
     * WHY: React state is in memory — it does not survive a page
     *      refresh. The access_token is gone on every load. But the
     *      httpOnly refresh token cookie may still be valid.
     *      We attempt to exchange it for a new access token silently.
     *
     *      Order inside the try block matters:
     *        1. refresh_token()      — exchange cookie for access token
     *        2. set_api_token(token) — sync to api.js BEFORE next call
     *        3. get_current_user()   — requires the token to be set
     */
    useEffect(() => {
        async function restore_session() {
            try {
                const token = await refresh_token()
                // Sync api.js first so get_current_user() has the token.
                set_api_token(token)
                const user = await get_current_user()
                setAccessToken(token)
                setCurrentUser(user)
            } catch {
                // No valid cookie or server rejected — user must log in.
                // access_token stays null → ProtectedRoute → /login.
            } finally {
                // Always clear the loading flag so the UI unblocks.
                setIsLoading(false)
            }
        }

        restore_session()
    }, []) // empty deps — run once on mount only

    // ─── Context functions ────────────────────────────────────────

    /*
     * FUNCTION : login_user_ctx
     * ─────────────────────────────────────────────────────────────
     * WHY      : Wraps api.login_user and hydrates the auth context.
     *            Calling api.login_user alone would not update React
     *            state — this function bridges the two layers.
     *
     * HOW      : 1. Call login_user() from api.js
     *            2. Store access_token in React state
     *            3. Store user in React state
     *            4. Sync token into api.js module store
     *
     * @param   {string} email
     * @param   {string} password
     * @throws  {AxiosError} — callers (LoginPage) handle this
     * ─────────────────────────────────────────────────────────────
     */
    async function login_user_ctx(email, password) {
        const { access_token: token, user } = await login_user(email, password)
        setAccessToken(token)
        setCurrentUser(user)
        set_api_token(token)
    }

    /*
     * FUNCTION : logout_user_ctx
     * ─────────────────────────────────────────────────────────────
     * WHY      : Clears all client auth state and revokes the
     *            server-side session.
     *
     * HOW      : ORDER MATTERS:
     *            1. Clear React state FIRST — ProtectedRoute detects
     *               the null token immediately and redirects, giving
     *               instant perceived logout regardless of network.
     *            2. Clear api.js token store.
     *            3. Call logout_user() to revoke the refresh token
     *               server-side and clear the httpOnly cookie.
     *
     *   ACCEPTED TRADEOFF:
     *     If step 3 fails (network error, server down), the httpOnly
     *     cookie is not cleared server-side. It will expire naturally
     *     in ≤7 days. During that window a stolen cookie could
     *     theoretically produce a new access token. We accept this
     *     because:
     *       a) The failure is logged for investigation.
     *       b) Client-side state is already gone — the user cannot
     *          do anything in the app.
     *       c) Server-side token rotation already limits the blast
     *          radius of any single compromised token.
     * ─────────────────────────────────────────────────────────────
     */
    async function logout_user_ctx() {
        // Step 1 + 2: clear client state first for instant UX.
        setAccessToken(null)
        setCurrentUser(null)
        set_api_token(null)

        // Step 3: revoke server-side session (best-effort).
        try {
            await logout_user()
        } catch (err) {
            // Log so the failure is visible in monitoring.
            // The httpOnly cookie will expire in ≤7 days — known tradeoff.
            console.error('[auth] logout server call failed:', err?.message)
        }
    }

    // ─── Context value ────────────────────────────────────────────
    const context_value = {
        current_user,
        access_token,
        is_loading,
        login_user: login_user_ctx,
        logout_user: logout_user_ctx,
        /*
         * NOTE: register_user is intentionally NOT exposed here.
         *   RegisterPage imports it directly from api.js because
         *   registration does not change auth state — adding it here
         *   would imply auto-login on register, which is not the UX goal.
         *   See auth_context.jsx header comment and Part 1 of the plan.
         */
    }

    return (
        <AuthContext.Provider value={context_value}>
            {children}
        </AuthContext.Provider>
    )
}

/*
 * FUNCTION : useAuth
 * ─────────────────────────────────────────────────────────────
 * WHY      : Convenience wrapper so components write useAuth()
 *            instead of useContext(AuthContext) everywhere.
 *            Also makes it easy to add a null-check in one place
 *            if AuthProvider is ever accidentally omitted.
 *
 * @returns {{ current_user, access_token, is_loading,
 *             login_user, logout_user }}
 * @throws  {Error} if used outside of AuthProvider
 * ─────────────────────────────────────────────────────────────
 */
export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>')
    }
    return ctx
}