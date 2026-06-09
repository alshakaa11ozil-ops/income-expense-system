/*
 * ============================================================
 * FILE    : api/categories.js
 * LAYER   : Service (HTTP — categories domain)
 * PURPOSE : API calls for /categories and /budget-goals endpoints.
 *           Covers both the dropdown (system + personal) and the
 *           full personal-category management surface (mine/*).
 *           Budget goal helpers live here because they are only
 *           ever used from the CategoriesPage context.
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - get_categories       : GET /categories (dropdown: system + own)
 *   - get_my_categories    : GET /categories/mine (manage list)
 *   - create_my_category   : POST /categories/mine
 *   - update_my_category   : PUT  /categories/mine/:id
 *   - delete_my_category   : DELETE /categories/mine/:id
 *   - get_budget_goals     : GET /budget-goals?month=&year=
 *   - save_budget_goal     : PUT /budget-goals (upsert one goal)
 *   - delete_budget_goal   : DELETE /budget-goals/:id?month=&year=
 * ============================================================
 */

import api from './client'

// ─────────────────────────────────────────────────────────────
// DROPDOWN (system + personal — used by RecordForm & SearchBar)
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : get_categories
 * WHY      : Record form's category field is a dropdown, not free
 *            text. Returns active system categories merged with the
 *            logged-in user's own personal categories.
 * @returns {Category[]} - [{ id, name, icon, color, user_id }]
 *          user_id is null for system categories
 */
export async function get_categories() {
    const response = await api.get('/categories')
    return response.data.data
}

// ─────────────────────────────────────────────────────────────
// PERSONAL CATEGORY MANAGEMENT (CategoriesPage)
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : get_my_categories
 * WHY      : Returns only the current user's personal categories
 *            for the manage page. The /categories endpoint also
 *            includes system categories (not editable), so we
 *            use /categories/mine for the manage view.
 * @returns {Category[]}
 */
export async function get_my_categories() {
    const response = await api.get('/categories/mine')
    return response.data.data
}

/*
 * FUNCTION : create_my_category
 * WHY      : Creates a new personal category owned by the current user.
 *            The backend sets user_id automatically from the JWT.
 * @param   {object} data - { name, icon, color }
 * @returns {Category} - the created category
 * @throws  {AxiosError} 409 if name already taken | 400 validation
 */
export async function create_my_category(data) {
    const response = await api.post('/categories/mine', data)
    return response.data.data
}

/*
 * FUNCTION : update_my_category
 * WHY      : Allows renaming, recoloring, or changing the icon on
 *            a personal category. The backend ensures the category
 *            belongs to the requesting user before writing.
 * @param   {string} id   - category id
 * @param   {object} data - { name?, icon?, color? }
 * @returns {Category}
 */
export async function update_my_category(id, data) {
    const response = await api.put(`/categories/mine/${id}`, data)
    return response.data.data
}

/*
 * FUNCTION : delete_my_category
 * WHY      : Hard-deletes a personal category. Backend rejects the
 *            request with 409 if any active records reference this
 *            category — prevents orphaned records.
 * @param   {string} id - category id
 * @returns {object}
 * @throws  {AxiosError} 409 if category is in use by records
 *          404 if not found or not owned by this user
 */
export async function delete_my_category(id) {
    const response = await api.delete(`/categories/mine/${id}`)
    return response.data.data
}

// ─────────────────────────────────────────────────────────────
// BUDGET GOALS (soft monthly limits — used in slide-out panel)
// ─────────────────────────────────────────────────────────────

/*
 * FUNCTION : get_budget_goals
 * WHY      : Fetches existing monthly limits so the category cards
 *            can render the progress bar with the correct limit value.
 *            We load them for the current month on CategoriesPage mount.
 * @param   {number} month - 1–12
 * @param   {number} year  - e.g. 2026
 * @returns {BudgetGoal[]}
 */
export async function get_budget_goals(month, year) {
    const response = await api.get('/budget-goals', { params: { month, year } })
    return response.data.data
}

/*
 * FUNCTION : save_budget_goal
 * WHY      : Upserts a single category's monthly limit. Wraps the
 *            bulk PUT endpoint by sending a one-item goals array with
 *            replace=false so other goals for this month are preserved.
 * @param   {string} category_id
 * @param   {number} amount      - the monthly limit value
 * @param   {number} month       - 1–12
 * @param   {number} year
 * @returns {BudgetGoal[]}
 */
export async function save_budget_goal(category_id, amount, month, year) {
    const response = await api.put('/budget-goals', {
        goals:   [{ category_id, amount }],
        month,
        year,
        replace: false,
    })
    return response.data.data
}

/*
 * FUNCTION : delete_budget_goal
 * WHY      : Removes the monthly limit for a category (user clicked
 *            "Clear limit"). month + year passed as query params so
 *            the backend can enforce the write window.
 * @param   {string} goal_id - the BudgetGoal row id
 * @param   {number} month
 * @param   {number} year
 * @returns {object}
 */
export async function delete_budget_goal(goal_id, month, year) {
    const response = await api.delete(`/budget-goals/${goal_id}`, {
        params: { month, year },
    })
    return response.data.data
}