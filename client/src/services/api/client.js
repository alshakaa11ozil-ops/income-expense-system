/*
 * ============================================================
 * FILE    : api/client.js
 * LAYER   : Service (HTTP core)
 * PURPOSE : The single Axios instance used by every api/* file.
 *           Owns the Bearer token injection (request interceptor)
 *           and the silent 401 → refresh → retry logic
 *           (response interceptor). No API functions live here —
 *           only the shared transport layer.
 * DEPENDS : axios
 * ============================================================
 * EXPORTS:
 *   - api (default)            : configured Axios instance
 *   - set_api_token            : sync token into module scope
 *   - get_access_token         : read token from module scope
 *   - register_auth_callbacks  : hook AuthContext into refresh/logout
 * ============================================================
 */

import axios from 'axios'

// ─────────────────────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────────────────────

const api = axios.create({
    baseURL: '/api',
    /*
     * WHY withCredentials: true:
     *   The refresh token lives in an httpOnly cookie. Browsers only
     *   send that cookie on cross-origin requests when withCredentials
     *   is true. Without this, every /auth/refresh call fails silently.
     */
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
})

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL TOKEN STORE
// ─────────────────────────────────────────────────────────────

/*
 * WHY module-level variable and not React state:
 *   This file is a plain ES module — it cannot use hooks.
 *   A module-level var lets the request interceptor read the token
 *   synchronously on every request. AuthContext calls set_api_token()
 *   on login, refresh, and logout to keep this in sync.
 */
let _access_token = null

export function set_api_token(token) {
    _access_token = token
}

export function get_access_token() {
    return _access_token
}

// ─────────────────────────────────────────────────────────────
// AUTH CALLBACKS
// ─────────────────────────────────────────────────────────────

/*
 * WHY callbacks instead of importing AuthContext:
 *   AuthContext imports this file → importing AuthContext here
 *   creates a circular dependency that crashes at runtime.
 *   AuthContext registers two callbacks once on mount; the
 *   response interceptor calls them to keep React state in sync.
 */
let _on_token_refresh = null
let _on_logout = null

/*
 * FUNCTION : register_auth_callbacks
 * WHY      : Lets AuthContext hook into token-refresh and forced-logout
 *            events that originate inside the response interceptor.
 * @param   {Function} on_token_refresh - called with new_token string
 * @param   {Function} on_logout        - called with no args on forced logout
 */
export function register_auth_callbacks({ on_token_refresh, on_logout }) {
    _on_token_refresh = on_token_refresh
    _on_logout = on_logout
}

// ─────────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR — attach Bearer token
// ─────────────────────────────────────────────────────────────

api.interceptors.request.use((config) => {
    const token = get_access_token()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// ─────────────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR — silent token refresh on 401
// ─────────────────────────────────────────────────────────────

/*
 * WHY is_refreshing + refresh_queue:
 *   Dashboard fires 4 parallel requests. If all return 401
 *   simultaneously, 4 refresh calls would fire. Token rotation
 *   means the 2nd–4th would fail (first refresh invalidates the
 *   cookie). is_refreshing serialises this: first 401 fires the
 *   refresh, the rest queue. When refresh completes, the queue
 *   drains with the new token. All 4 requests succeed with 1
 *   refresh call.
 *
 * WHY _retry FLAG:
 *   Prevents an infinite loop if a freshly-refreshed token is
 *   immediately rejected (clock skew, propagation delay).
 */
let is_refreshing = false
let refresh_queue = []

api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const original_request = error.config

        if (error.response?.status !== 401) {
            return Promise.reject(error)
        }

        // never retry the refresh endpoint itself
        if (original_request.url === '/auth/refresh') {
            return Promise.reject(error)
        }

        // never retry a request that has already been retried
        if (original_request._retry) {
            return Promise.reject(error)
        }

        if (is_refreshing) {
            // queue this request until the in-flight refresh completes
            return new Promise((resolve, reject) => {
                refresh_queue.push({ resolve, reject })
            }).then((token) => {
                original_request.headers.Authorization = `Bearer ${token}`
                return api(original_request)
            })
        }

        is_refreshing = true
        original_request._retry = true

        try {
            const response = await api.post('/auth/refresh')
            const new_token = response.data.data.access_token

            set_api_token(new_token)
            if (_on_token_refresh) _on_token_refresh(new_token)

            refresh_queue.forEach(({ resolve }) => resolve(new_token))
            refresh_queue = []

            original_request.headers.Authorization = `Bearer ${new_token}`
            return api(original_request)
        } catch (refresh_error) {
            refresh_queue.forEach(({ reject }) => reject(refresh_error))
            refresh_queue = []
            if (_on_logout) _on_logout()
            return Promise.reject(refresh_error)
        } finally {
            is_refreshing = false
        }
    }
)

export default api