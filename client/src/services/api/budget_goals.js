/*
 * ============================================================
 * FILE    : api/budget_goals.js
 * LAYER   : Service (HTTP — budget goals domain)
 * PURPOSE : Budget goal API calls used exclusively by the AI
 *           planner tab. Handles bulk save (with replace), fetch
 *           for the goals dashboard, and single-goal deletion.
 *           Single-category upsert lives in categories.js because
 *           CategoriesPage already imports from there.
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - get_budget_goals_for_planner : GET /budget-goals?month&year
 *   - save_budget_goals            : PUT /budget-goals (bulk, replace=true)
 *   - delete_budget_goal_by_id     : DELETE /budget-goals/:id
 * ============================================================
 */

import api from './client'

/*
 * FUNCTION : get_budget_goals_for_planner
 * ─────────────────────────────────────────────────────────
 * WHY      : The AI planner dashboard needs enriched goals that
 *            include actual spending so progress bars show real
 *            vs planned amounts. This is the planner's dedicated
 *            fetch — CategoriesPage uses get_budget_goals from
 *            categories.js so the two don't share state.
 *
 * HOW      : 1. GET /budget-goals?month=&year=
 *            2. Unwrap and return enriched goal array
 *
 * @param   {number} month - 1–12
 * @param   {number} year  - e.g. 2026
 * @returns {EnrichedGoal[]}
 *   [{ goal_id, category_id, category_name, icon, color,
 *      goal_amount, spent, remaining, percentage, is_over_budget }]
 * ─────────────────────────────────────────────────────────
 */
export async function get_budget_goals_for_planner(month, year) {
    const response = await api.get('/budget-goals', { params: { month, year } })
    return response.data.data
}

/*
 * FUNCTION : save_budget_goals
 * ─────────────────────────────────────────────────────────
 * WHY      : After the user reviews and edits the AI-suggested
 *            budget plan, this writes ALL goals for a month at
 *            once. replace=true clears any existing goals for that
 *            month first so stale categories from a previous plan
 *            session don't persist alongside the new ones.
 *
 * HOW      : 1. PUT /budget-goals with full goals array
 *            2. replace flag tells backend to DELETE existing rows
 *               for this month before inserting the new set
 *            3. Return the enriched goals array for immediate
 *               dashboard display without a second fetch
 *
 * @param   {Goal[]} goals      - [{ category_id, amount }]
 * @param   {number} month      - 1–12
 * @param   {number} year       - e.g. 2026
 * @param   {boolean} replace   - true = clear old goals first (default true)
 * @returns {EnrichedGoal[]}
 * @throws  400 if month is in the past or more than 3 months ahead
 * ─────────────────────────────────────────────────────────
 */
export async function save_budget_goals(goals, month, year, replace = true) {
    const response = await api.put('/budget-goals', { goals, month, year, replace })
    return response.data.data
}

/*
 * FUNCTION : delete_budget_goal_by_id
 * ─────────────────────────────────────────────────────────
 * WHY      : The planner dashboard's × button lets users remove
 *            a single category from their budget plan without
 *            regenerating the whole plan. Named _by_id to
 *            distinguish from delete_budget_goal in categories.js
 *            which is used by CategoriesPage.
 *
 * HOW      : 1. DELETE /budget-goals/:goal_id
 *            2. Return the deleted goal so the caller can show
 *               the category name in the success toast
 *
 * @param   {string} goal_id - CUID of the BudgetGoal row
 * @returns {BudgetGoal}     - the deleted goal object
 * ─────────────────────────────────────────────────────────
 */
export async function delete_budget_goal_by_id(goal_id) {
    const response = await api.delete(`/budget-goals/${goal_id}`)
    return response.data.data
}