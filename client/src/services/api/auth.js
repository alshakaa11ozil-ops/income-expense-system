/*
 * ============================================================
 * FILE    : api/auth.js
 * LAYER   : Service (HTTP — auth domain)
 * PURPOSE : All API calls for the /auth/* endpoints.
 *           login, register, logout, token refresh, current user.
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - login_user        : POST /auth/login
 *   - register_user     : POST /auth/register
 *   - logout_user       : POST /auth/logout
 *   - refresh_token     : POST /auth/refresh
 *   - get_current_user  : GET  /auth/me
 * ============================================================
 */

import api from './client'

/*
 * FUNCTION : login_user
 * WHY      : Sends credentials. Server sets httpOnly refresh cookie
 *            and returns the short-lived access token in the body.
 *            AuthContext stores the token in memory (never localStorage).
 * @param   {string} email
 * @param   {string} password
 * @returns {{ access_token: string, user: object }}
 * @throws  {AxiosError} 401 wrong password | 403 deactivated | 400 validation
 */
export async function login_user(email, password) {
    const response = await api.post('/auth/login', { email, password })
    return response.data.data
}

/*
 * FUNCTION : register_user
 * WHY      : Creates a new USER account. Does NOT auto-login —
 *            caller redirects to /login after. Not in AuthContext
 *            because registration does not change auth state.
 * @param   {string} username
 * @param   {string} email
 * @param   {string} password
 * @returns {object} created user (no password field)
 * @throws  {AxiosError} 409 duplicate email | 400 validation
 */
export async function register_user(username, email, password) {
    const response = await api.post('/auth/register', { username, email, password })
    return response.data.data
}

/*
 * FUNCTION : logout_user
 * WHY      : Revokes the refresh token server-side and clears the
 *            httpOnly cookie. Client state is cleared first by
 *            AuthContext before this call is made.
 * @returns {void}
 */
export async function logout_user() {
    await api.post('/auth/logout')
}

/*
 * FUNCTION : refresh_token
 * WHY      : Called once on app load to silently restore a session.
 *            Access token lives in memory — it's lost on page refresh.
 *            The httpOnly cookie is sent automatically by the browser.
 * @returns {string} new access_token
 * @throws  {AxiosError} 401 if cookie missing/expired/revoked
 */
export async function refresh_token() {
    const response = await api.post('/auth/refresh')
    return response.data.data.access_token
}

/*
 * FUNCTION : get_current_user
 * WHY      : Fetches the full user profile after silent refresh on
 *            app load. AuthContext needs current_user (role, limits)
 *            to gate features — the token alone doesn't carry this.
 * @returns {object} user without password field
 */
export async function get_current_user() {
    const response = await api.get('/auth/me')
    return response.data.data
}

/*
 * FUNCTION : change_password
 * WHY      : Allows a user to update their own password from /profile.
 *            Current password required to prevent unauthorized changes.
 * @param   {string} current_password
 * @param   {string} new_password
 * @returns {{ message: string }}
 * @throws  400 if current_password is wrong or new_password invalid
 */
export async function change_password(current_password, new_password) {
    const response = await api.patch('/auth/me/password', { current_password, new_password })
    return response.data.data
}