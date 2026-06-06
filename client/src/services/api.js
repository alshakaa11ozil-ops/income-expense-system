/*
 * ============================================================
 * FILE    : api.js
 * LAYER   : Service (HTTP)
 * PURPOSE : Single Axios instance used by every API call in the
 *           app. Owns the 401 silent-refresh interceptor and
 *           Bearer token injection. All API functions are exported
 *           from here — components never call axios directly.
 * DEPENDS : axios
 * ============================================================
 * EXPORTS:
 *   - api (default)           : configured Axios instance
 *   - set_api_token           : sync token into module scope
 *   - get_access_token        : read token from module scope
 *   - register_auth_callbacks : hook AuthContext into refresh/logout events
 *   - login_user              : POST /auth/login
 *   - register_user           : POST /auth/register
 *   - logout_user             : POST /auth/logout
 *   - refresh_token           : POST /auth/refresh
 *   - get_current_user        : GET  /auth/me
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
   *   The refresh token lives in an httpOnly cookie. The browser
   *   only sends that cookie with cross-origin requests when
   *   withCredentials is true. Without this the /auth/refresh call
   *   never carries the cookie and every refresh attempt fails.
   */
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL TOKEN STORE
// ─────────────────────────────────────────────────────────────

/*
 * WHY a module-level variable and not React state:
 *   api.js is a plain ES module — it cannot use React hooks.
 *   A module-level variable lets the interceptor read the current
 *   token synchronously on every request without React involvement.
 *   AuthContext calls set_api_token() whenever the token changes
 *   (login, refresh, logout) to keep this in sync.
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
 *   Importing AuthContext here would create a circular dependency
 *   (AuthContext imports api.js, api.js imports AuthContext).
 *   Instead, AuthContext registers two callbacks once on mount,
 *   and the interceptor calls them when it silently refreshes a
 *   token or forces a logout — keeping React state in sync without
 *   a circular import.
 *
 *   These are plain module-level variables, not React state, so they
 *   exist immediately when the module is imported — before any
 *   useEffect fires. This prevents the race condition where an early
 *   401 would fire before the callbacks were registered.
 */
let _on_token_refresh = null
let _on_logout = null

/*
 * FUNCTION : register_auth_callbacks
 * ─────────────────────────────────────────────────────────────
 * WHY      : Gives AuthContext a way to hook into token-refresh
 *            and logout events that originate inside the interceptor.
 *            Called once from AuthContext's first useEffect.
 *
 * HOW      : Stores the two callbacks in module scope. The response
 *            interceptor calls them when appropriate.
 *
 * @param   {Function} on_token_refresh - called with new_token string
 * @param   {Function} on_logout        - called with no args on forced logout
 * ─────────────────────────────────────────────────────────────
 */
export function register_auth_callbacks({ on_token_refresh, on_logout }) {
  _on_token_refresh = on_token_refresh
  _on_logout = on_logout
}

// ─────────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR — attach Bearer token
// ─────────────────────────────────────────────────────────────

/*
 * WHY an interceptor and not manual headers per call:
 *   With 20+ API functions across 5 feature areas, manually
 *   attaching the Authorization header everywhere is error-prone.
 *   One interceptor handles all calls automatically.
 */
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
 * WHY is_refreshing EXISTS:
 *   Without this flag, two simultaneous 401 responses (common on
 *   the dashboard which fires 4 parallel fetches) would both trigger
 *   a refresh call. Token rotation means the first refresh
 *   invalidates the cookie — the second refresh call fails, killing
 *   the session. The flag serialises refresh: one fires, others queue.
 *
 * WHY refresh_queue EXISTS:
 *   While a refresh is in progress, subsequent 401 requests must
 *   wait. They push resolve/reject into this queue. When the refresh
 *   completes, every queued request is retried with the new token.
 *   When the refresh fails, every queued request is rejected and
 *   the user is logged out once, cleanly.
 *
 * WHY _retry FLAG ON original_request:
 *   Marks a request as having already been retried once. Prevents
 *   an edge case where a freshly-refreshed token is immediately
 *   rejected (clock skew, propagation delay) from entering a tight
 *   retry loop. In Axios ≥1.x custom config properties survive the
 *   internal config clone. If you are on Axios <1.0.0 use a WeakSet:
 *     const retried_configs = new WeakSet()
 *     retried_configs.add(original_request) / .has(original_request)
 */
let is_refreshing = false
let refresh_queue = []

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const original_request = error.config

    // Pass non-401 errors through unchanged.
    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    /*
     * Guard 1 — never retry the refresh endpoint itself.
     *   If POST /auth/refresh returns 401, the refresh token has
     *   expired or been revoked. Retrying would loop forever.
     *   Reject immediately so the catch below triggers logout.
     */
    if (original_request.url === '/auth/refresh') {
      return Promise.reject(error)
    }

    /*
     * Guard 2 — never retry a request that already was retried.
     *   Catches the clock-skew edge case described above.
     */
    if (original_request._retry) {
      return Promise.reject(error)
    }

    if (is_refreshing) {
      /*
       * A refresh is already in flight — queue this request.
       * The promise resolves when the in-flight refresh completes
       * and passes the new token, then retries the original call.
       */
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

      // Sync the module-level store immediately so any in-flight
      // requests that retry after this point get the new token.
      set_api_token(new_token)

      // Notify AuthContext so React state updates and the UI
      // reflects the refreshed session.
      if (_on_token_refresh) _on_token_refresh(new_token)

      // Drain the queue — retry every waiting request.
      refresh_queue.forEach(({ resolve }) => resolve(new_token))
      refresh_queue = []

      original_request.headers.Authorization = `Bearer ${new_token}`
      return api(original_request)
    } catch (refresh_error) {
      // Refresh failed — drain the queue with rejections, clear
      // the token, and tell AuthContext to force a logout.
      refresh_queue.forEach(({ reject }) => reject(refresh_error))
      refresh_queue = []
      if (_on_logout) _on_logout()
      return Promise.reject(refresh_error)
    } finally {
      is_refreshing = false
    }
  }
)

// ─────────────────────────────────────────────────────────────
// AUTH API FUNCTIONS
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : login_user
 * ─────────────────────────────────────────────────────────────
 * WHY      : Sends credentials to the server. On success the server
 *            sets the httpOnly refresh token cookie and returns
 *            the short-lived access token in the response body.
 *
 * HOW      : 1. POST /auth/login with email + password
 *            2. Return the data payload — AuthContext stores it
 *
 * @param   {string} email    - user's email address
 * @param   {string} password - user's plaintext password
 * @returns {{ access_token: string, user: object }}
 * @throws  {AxiosError} 401 wrong password | 403 deactivated | 400 validation
 * ─────────────────────────────────────────────────────────────
 */
export async function login_user(email, password) {
  const response = await api.post('/auth/login', { email, password })
  return response.data.data
}

/*
 * FUNCTION : register_user
 * ─────────────────────────────────────────────────────────────
 * WHY      : Creates a new USER account. Deliberately does NOT log
 *            the user in — the caller redirects to /login after.
 *            This function is intentionally NOT in AuthContext because
 *            registration does not change auth state. Adding it to
 *            context would imply auto-login, which is not the UX goal.
 *
 * HOW      : 1. POST /auth/register with username, email, password
 *            2. Return the created user object
 *
 * @param   {string} username - display name, min 3 chars, no spaces
 * @param   {string} email    - must be unique
 * @param   {string} password - min 8 chars
 * @returns {object} - created user (no password field)
 * @throws  {AxiosError} 409 duplicate email | 400 validation
 * ─────────────────────────────────────────────────────────────
 */
export async function register_user(username, email, password) {
  const response = await api.post('/auth/register', { username, email, password })
  return response.data.data
}

/*
 * FUNCTION : logout_user
 * ─────────────────────────────────────────────────────────────
 * WHY      : Revokes the refresh token server-side and instructs
 *            the browser to clear the httpOnly cookie. If this
 *            call fails, the cookie expires naturally after 7 days.
 *            Client state is cleared BEFORE this call is made by
 *            logout_user_ctx — see auth_context.jsx for the order
 *            and the accepted tradeoff.
 *
 * HOW      : 1. POST /auth/logout (Authorization header auto-attached
 *               by the request interceptor)
 *
 * @returns {void}
 * @throws  {AxiosError} - failure is caught and logged by auth_context
 * ─────────────────────────────────────────────────────────────
 */
export async function logout_user() {
  await api.post('/auth/logout')
}

/*
 * FUNCTION : refresh_token
 * ─────────────────────────────────────────────────────────────
 * WHY      : Called once on app load to silently restore the session.
 *            React state is empty after a page refresh (access_token
 *            lives in memory, not localStorage). The httpOnly cookie
 *            is sent automatically by the browser — if it is valid,
 *            the server returns a new access token.
 *
 * HOW      : 1. POST /auth/refresh (no body — cookie is the credential)
 *            2. Return the new access token string
 *
 * @returns {string} - new access_token
 * @throws  {AxiosError} 401 if cookie missing/expired/revoked
 * ─────────────────────────────────────────────────────────────
 */
export async function refresh_token() {
  const response = await api.post('/auth/refresh')
  return response.data.data.access_token
}

/*
 * FUNCTION : get_current_user
 * ─────────────────────────────────────────────────────────────
 * WHY      : Fetches the full user profile after a silent refresh
 *            restores the session on app load. Called immediately
 *            after refresh_token() succeeds so the context has the
 *            current_user object (role, ai_daily_limit, etc.).
 *
 * HOW      : 1. GET /auth/me (Authorization header auto-attached)
 *            2. Return the user object
 *
 * @returns {object} - user without password field
 * @throws  {AxiosError} 401 if token invalid
 * ─────────────────────────────────────────────────────────────
 */
export async function get_current_user() {
  const response = await api.get('/auth/me')
  return response.data.data
}
/*
 * ============================================================
 * FILE    : api.js  ← ADDITIONS ONLY (Chat 8)
 * LAYER   : Service (HTTP client)
 * PURPOSE : Append these functions to the EXISTING api.js from
 *           Chat 7. Do NOT rewrite the file — only add below
 *           the existing exports.
 *
 *           Chat 8 adds: categories, record CRUD, bulk ops,
 *           CSV export, and date-range analytics summary.
 * DEPENDS : axios instance (api) already configured in Chat 7
 * ============================================================
 * NEW EXPORTS (add to existing export block at bottom):
 *   - get_categories                  : category dropdown data
 *   - generate_record_id              : auto-suggested unique ID
 *   - create_record                   : POST /records
 *   - get_records                     : GET  /records (filtered + paginated)
 *   - get_record                      : GET  /records/:id
 *   - update_record                   : PUT  /records/:id
 *   - delete_record                   : DELETE /records/:id (soft)
 *   - bulk_delete_records             : DELETE /records/bulk
 *   - export_records                  : GET  /records/export → CSV download
 *   - get_analytics_summary_for_range : GET  /analytics/summary?date_from&date_to
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : get_categories
 * ─────────────────────────────────────────────────────────
 * WHY      : The record form's category field is a dropdown,
 *            not free text. Free text causes "Food", "food",
 *            "FOOD" to appear as three separate categories in
 *            analytics. This loads the canonical list from
 *            the backend (27 system + user's personal ones).
 * HOW      : 1. GET /categories
 *            2. Return the data array directly
 * @returns {Category[]} - [{ id, name, icon, color, user_id }]
 * ─────────────────────────────────────────────────────────
 */
export async function get_categories() {
  const response = await api.get('/categories')
  return response.data.data
}

// ─────────────────────────────────────────────────────────────
// RECORD ID GENERATION
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : generate_record_id
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requires user-defined record IDs with
 *            uniqueness check. Asking users to manually type
 *            "REC-001" every time is friction. This pre-fills
 *            the form with a valid, guaranteed-unique suggestion.
 *            The backend uses the current date + sequence so
 *            two open tabs cannot generate the same ID.
 * HOW      : 1. GET /records/generate-id
 *            2. Return the suggested_id string
 * @returns {string} - e.g. "REC-20260602-0003"
 * ─────────────────────────────────────────────────────────
 */
export async function generate_record_id() {
  const response = await api.get('/records/generate-id')
  return response.data.data.suggested_id
}

// ─────────────────────────────────────────────────────────────
// RECORD CRUD
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : create_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Creates a new income/expense record. Backend runs
 *            the duplicate ID check and mandatory field validation.
 *            If the ID already exists, backend returns 409 which
 *            the form catches and displays under the ID field.
 * HOW      : 1. POST /records with full record payload
 *            2. Return the created record object
 * @param   {object} record_data - { id, type, amount, category_id,
 *                                   date, operator, notes }
 * @returns {Record}
 * @throws  {Error} 409 if record ID already exists
 *          {Error} 400 if validation fails
 * ─────────────────────────────────────────────────────────
 */
export async function create_record(record_data) {
  const response = await api.post('/records', record_data)
  return response.data.data
}

/*
 * FUNCTION : get_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Fetches paginated, server-filtered records for the
 *            table. All filtering happens on the DB — the client
 *            never fetches all records and filters in JS. This
 *            is required by the teacher spec ("server-side search")
 *            and is the only approach that works at scale.
 * HOW      : 1. Build query params from filters object
 *            2. GET /records?record_id=&type=&category_id=&page=&limit=
 *            3. Return { data: Record[], pagination: object }
 * @param   {object} filters - { record_id, type, category_id,
 *                               date_from, date_to, page, limit }
 * @returns {{ data: Record[], pagination: { total, page, limit, total_pages } }}
 * ─────────────────────────────────────────────────────────
 */
export async function get_records(filters = {}) {
  const response = await api.get('/records', { params: filters })
  // return the full response.data so the caller gets both
  // data[] and pagination{}
  return response.data
}

/*
 * FUNCTION : get_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Loads a single record to populate the edit form.
 *            Using the list endpoint would return stale data if
 *            the record was just edited by another session.
 * HOW      : 1. GET /records/:id
 *            2. Return the single record object
 * @param   {string} record_id - the record's string ID (e.g. "REC-001")
 * @returns {Record}
 * ─────────────────────────────────────────────────────────
 */
export async function get_record(record_id) {
  const response = await api.get(`/records/${record_id}`)
  return response.data.data
}

/*
 * FUNCTION : update_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Updates an existing record. The record's id field
 *            must NOT be included in the payload — the backend
 *            treats id as immutable (teacher requirement). We
 *            enforce this in two places: the caller strips id
 *            before calling this function, and the service layer
 *            also strips it as a second line of defence.
 * HOW      : 1. PUT /records/:id with payload (no id field)
 *            2. Return the updated record object
 * @param   {string} record_id   - path param (the record to update)
 * @param   {object} record_data - update payload — MUST NOT contain id
 * @returns {Record}
 * @throws  {Error} 400 if validation fails
 * ─────────────────────────────────────────────────────────
 */
export async function update_record(record_id, record_data) {
  const response = await api.put(`/records/${record_id}`, record_data)
  return response.data.data
}

/*
 * FUNCTION : delete_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Soft-deletes a record. The row is NOT removed from
 *            the database — deleted_at is set so it disappears
 *            from the user's view. Admins can still see and
 *            restore soft-deleted records for audit purposes.
 * HOW      : 1. DELETE /records/:id
 *            2. Backend sets deleted_at = now(), deleted_by = user_id
 * @param   {string} record_id - the record's string ID
 * @returns {object} - { success: true }
 * ─────────────────────────────────────────────────────────
 */
export async function delete_record(record_id) {
  const response = await api.delete(`/records/${record_id}`)
  return response.data
}

/*
 * FUNCTION : bulk_delete_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Soft-deletes multiple records in a single request.
 *            More efficient than looping individual delete calls
 *            (1 network round trip vs N round trips for N records).
 * HOW      : 1. DELETE /records/bulk with { ids: [...] } body
 *            2. Axios DELETE with body requires { data: { ids } }
 *               syntax — DELETE requests do not normally carry
 *               a body, so Axios puts it in the config.data field.
 * @param   {string[]} ids - array of record string IDs
 * @returns {object} - { success: true }
 * ─────────────────────────────────────────────────────────
 */
export async function bulk_delete_records(ids) {
  // WHY { data: { ids } }: Axios DELETE requests pass the body
  // through config.data, not the second argument (which is config).
  const response = await api.delete('/records/bulk', { data: { ids } })
  return response.data
}

// ─────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : export_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Downloads a CSV of all records matching the current
 *            search filters. Passing the same filters ensures the
 *            CSV contains exactly what the user sees in the table —
 *            no surprises with extra or missing records.
 * HOW      : 1. GET /records/export with current filters as params
 *            2. responseType: 'blob' tells Axios to treat response
 *               as a binary file (critical — without this Axios
 *               tries to parse CSV text as JSON and fails)
 *            3. Create an object URL from the blob
 *            4. Inject a hidden <a> tag, click it, then remove it
 *            5. Revoke the object URL to free browser memory
 * @param   {object} filters - same filter keys as get_records
 * @returns {void} - triggers browser file download as side effect
 * ─────────────────────────────────────────────────────────
 */
export async function export_records(filters = {}) {
  const response = await api.get('/records/export', {
    params: filters,
    responseType: 'blob',  // CRITICAL: binary file download
  })

  // create a temporary URL for the blob and trigger download
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'records_export.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()

  // free memory — object URLs persist until explicitly revoked
  window.URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS (date-range variant — for period summary bar)
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : get_analytics_summary_for_range
 * ─────────────────────────────────────────────────────────
 * WHY      : When the user filters records by date range, the
 *            page should show income/expense totals for that
 *            specific period above the table. This calls the
 *            same analytics/summary endpoint as the dashboard
 *            but uses date_from/date_to params (Mode B) instead
 *            of month/year (Mode A).
 *
 *            IMPORTANT: Verify analytics_controller.js handles
 *            the date_from/date_to branch before assuming this
 *            works — see Chat 8 review notes.
 * HOW      : 1. GET /analytics/summary?date_from=X&date_to=Y
 *            2. Return the summary object directly
 * @param   {string} date_from - "YYYY-MM-DD"
 * @param   {string} date_to   - "YYYY-MM-DD"
 * @returns {{ total_income, total_expense, net_balance, record_count }}
 *          All amounts as strings: "1500.00"
 * ─────────────────────────────────────────────────────────
 */
export async function get_analytics_summary_for_range(date_from, date_to) {
  const response = await api.get('/analytics/summary', {
    params: { date_from, date_to },
  })
  return response.data.data
}



export default api