/*
 * ============================================================
 * FILE    : budget_goal_model.js
 * LAYER   : Model
 * PURPOSE : All Prisma queries for the BudgetGoal table
 * DEPENDS : src/config/database.js (Prisma singleton)
 * ============================================================
 * EXPORTS:
 *   - get_goals_for_month    : fetch goals for a user/month/year
 *   - upsert_goal            : create or update a single goal
 *   - delete_goal            : remove one goal (ownership checked)
 *   - delete_all_for_month   : wipe all goals for a month (replace flow)
 * ============================================================
 */

const prisma = require('../config/database');

/*
 * FUNCTION : get_goals_for_month
 * ─────────────────────────────────────────────────────────
 * WHY      : Fetch all saved budget goals for a specific month.
 *            Used by: dashboard progress bars, AI context builder,
 *            Tab 2 (Purchase Advisor), Tab 3 (Finance Chat).
 *
 * HOW      : prisma.budgetGoal.findMany where user_id + month + year
 *            include: category (id, name, icon, color)
 *
 * @param   {string} user_id
 * @param   {number} month  - 1 to 12
 * @param   {number} year
 * @returns {BudgetGoal[]} - with category joined
 * ─────────────────────────────────────────────────────────
 */
async function get_goals_for_month(user_id, month, year) {
    return prisma.budgetGoal.findMany({
        where: { user_id, month, year },
        include: {
            category: {
                select: { id: true, name: true, icon: true, color: true },
            },
        },
        orderBy: { category: { name: 'asc' } },
    });
}

/*
 * FUNCTION : upsert_goal
 * ─────────────────────────────────────────────────────────
 * WHY      : AI planner sends a full list of suggested goals.
 *            Each one should create a new goal or update the existing
 *            one if the user already has a goal for that category/month.
 *            Upsert handles both cases in one DB call.
 *
 * HOW      : prisma.budgetGoal.upsert
 *            where: unique(user_id, category_id, month, year)
 *            create: all fields
 *            update: { amount } only
 *
 * @param   {string}  user_id
 * @param   {string}  category_id
 * @param   {Decimal} amount
 * @param   {number}  month
 * @param   {number}  year
 * @returns {BudgetGoal}
 * ─────────────────────────────────────────────────────────
 */
async function upsert_goal(user_id, category_id, amount, month, year) {
    return prisma.budgetGoal.upsert({
        where: {
            // unique constraint: one goal per user/category/month/year
            user_id_category_id_month_year: { user_id, category_id, month, year },
        },
        create: { user_id, category_id, amount, month, year },
        // only the amount changes on update — month/year/category are identity fields
        update: { amount },
        include: {
            category: {
                select: { id: true, name: true, icon: true, color: true },
            },
        },
    });
}

/*
 * FUNCTION : delete_goal
 * ─────────────────────────────────────────────────────────
 * WHY      : User removes a specific category from their budget plan.
 *
 * HOW      : prisma.budgetGoal.delete where id = goal_id AND user_id = user_id
 *            WHY include user_id: ownership check — user can only
 *            delete their own goals, not another user's
 *
 * @param   {string} goal_id
 * @param   {string} user_id
 * @returns {BudgetGoal}
 * ─────────────────────────────────────────────────────────
 */
async function delete_goal(goal_id, user_id) {
    return prisma.budgetGoal.delete({
        where: { id: goal_id, user_id },
    });
}

/*
 * FUNCTION : delete_all_for_month
 * ─────────────────────────────────────────────────────────
 * WHY      : When user clicks "Replace existing plan" and saves a
 *            new AI plan, we clear the old goals first then insert fresh.
 *            Cleaner than upsert-per-row when the whole month is replaced.
 *
 * HOW      : prisma.budgetGoal.deleteMany where user_id + month + year
 *
 * @param   {string} user_id
 * @param   {number} month
 * @param   {number} year
 * @returns {number} - count of deleted rows
 * ─────────────────────────────────────────────────────────
 */
async function delete_all_for_month(user_id, month, year) {
    const result = await prisma.budgetGoal.deleteMany({
        where: { user_id, month, year },
    });
    return result.count;
}

module.exports = {
    get_goals_for_month,
    upsert_goal,
    delete_goal,
    delete_all_for_month,
};