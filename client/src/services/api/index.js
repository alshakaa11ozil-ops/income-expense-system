/*
 * ============================================================
 * FILE    : api/index.js
 * LAYER   : Service (HTTP — barrel export)
 * PURPOSE : Single import point for all API functions.
 *           Components import from 'services/api' and this file
 *           re-exports from the domain-specific sub-files.
 *
 *           Old:  import { create_record } from '../services/api'
 *           New:  import { create_record } from '../services/api'
 *                 ← identical import path, nothing breaks
 *
 * DEPENDS : api/client, api/auth, api/records, api/categories,
 *           api/budget_goals, api/analytics, api/ai
 * ============================================================
 * FILE LAYOUT:
 *   client/src/services/
 *     api/
 *       index.js        ← this file (barrel)
 *       client.js       ← Axios instance + interceptors + token
 *       auth.js         ← login, register, logout, refresh, me
 *       records.js      ← CRUD, bulk delete, export, generate-id
 *       categories.js   ← get/create/update/delete categories
 *                          + single-goal upsert (CategoriesPage)
 *       budget_goals.js ← bulk save, dashboard fetch, goal delete
 *                          (AI planner tab only)
 *       analytics.js    ← summary, trends, categories, daily
 *       ai.js           ← plan, advise, analyze, usage
 * ============================================================
 */

// ── Core client (used by other files — re-exported for AuthContext) ──
export {
    default as api,
    set_api_token,
    get_access_token,
    register_auth_callbacks,
} from './client'

// ── Auth ─────────────────────────────────────────────────────
export {
    login_user,
    register_user,
    logout_user,
    refresh_token,
    get_current_user,
} from './auth'

// ── Categories & single-category budget goals ─────────────────
export {
    get_categories,
    get_my_categories,
    create_my_category,
    update_my_category,
    delete_my_category,
    get_budget_goals,
    save_budget_goal,
    delete_budget_goal,
} from './categories'

// ── AI planner bulk budget goals ──────────────────────────────
export {
    get_budget_goals_for_planner,
    save_budget_goals,
    delete_budget_goal_by_id,
} from './budget_goals'

// ── Records ──────────────────────────────────────────────────
export {
    generate_record_id,
    create_record,
    get_records,
    get_record,
    update_record,
    delete_record,
    bulk_delete_records,
    export_records,
} from './records'

// ── Analytics ────────────────────────────────────────────────
export {
    get_analytics_summary,
    get_analytics_summary_for_range,
    get_analytics_trends,
    get_analytics_categories,
    get_analytics_category_activity,
    get_analytics_daily,
} from './analytics'

// ── AI ───────────────────────────────────────────────────────
export {
    ai_plan_expenses,
    ai_advise_purchase,
    ai_analyze_finances,
    get_ai_usage,
} from './ai'

// ── Admin (ADMIN role only) ───────────────────────────────────
export {
    admin_get_users,
    admin_get_user,
    admin_toggle_user,
    admin_promote_user,
    admin_add_note,
    admin_get_audit_records,
    admin_restore_record,
    admin_hard_delete_record,
    admin_get_dashboard,
    admin_get_ai_usage,
    admin_get_categories,
    admin_create_category,
    admin_update_category,
    admin_deactivate_category,
} from './admin'