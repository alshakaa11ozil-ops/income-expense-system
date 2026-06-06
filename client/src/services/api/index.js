/*
 * ============================================================
 * FILE    : api/index.js
 * LAYER   : Service (HTTP — barrel export)
 * PURPOSE : Single import point for all API functions.
 *           Components import from 'services/api' and this file
 *           re-exports from the domain-specific sub-files.
 *           This is a drop-in replacement for the old monolithic
 *           api.js — no component imports need to change.
 *
 *           Old:  import { create_record } from '../services/api'
 *           New:  import { create_record } from '../services/api'
 *                 ← identical import path, nothing breaks
 *
 * DEPENDS : api/client, api/auth, api/records,
 *           api/categories, api/analytics, api/ai
 * ============================================================
 * FILE LAYOUT:
 *   client/src/services/
 *     api/
 *       index.js       ← this file (barrel)
 *       client.js      ← Axios instance + interceptors + token
 *       auth.js        ← login, register, logout, refresh, me
 *       records.js     ← CRUD, bulk delete, export, generate-id
 *       categories.js  ← get_categories
 *       analytics.js   ← summary, trends, categories, daily
 *       ai.js          ← plan, advise, analyze
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

// ── Categories ───────────────────────────────────────────────
export { get_categories } from './categories'

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
    get_analytics_daily,
} from './analytics'

// ── AI ───────────────────────────────────────────────────────
export {
    ai_plan_expenses,
    ai_advise_purchase,
    ai_analyze_finances,
} from './ai'