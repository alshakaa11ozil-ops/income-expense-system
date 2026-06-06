/*
 * ============================================================
 * FILE    : admin_routes.js
 * LAYER   : Route
 * PURPOSE : Map HTTP endpoints to admin controller handlers
 * DEPENDS : src/controllers/admin_controller.js,
 *           src/middleware/auth_middleware.js
 * ============================================================
 * EXPORTS:
 *   - router : Express router with admin user management routes
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const admin_controller = require('../controllers/admin_controller');
const { attach_user, require_role } = require('../middleware/auth_middleware');

// all admin routes require authentication + ADMIN role
const admin_guard = [attach_user, require_role(['ADMIN'])];

router.get('/admin/users', admin_guard, admin_controller.list_users);
router.get('/admin/users/:id', admin_guard, admin_controller.get_user);
router.patch('/admin/users/:id/toggle', admin_guard, admin_controller.toggle_user);

// WHY PATCH not PUT: we are partially updating one field, not replacing the whole resource
router.patch('/admin/users/:id/role', admin_guard, admin_controller.promote_user);
router.patch('/admin/users/:id/note', admin_guard, admin_controller.add_note);
/*
 * ============================================================
 * ADDITIONS TO admin_routes.js — Chat 6
 * ============================================================
 * WHY these routes live under /api/admin/ (not /api/records/):
 *   The /api/records/ routes handle a user's OWN records.
 *   These routes let an admin view ANY user's records.
 *   Keeping them under /api/admin/ makes the permission boundary
 *   immediately visible in the URL — you know at a glance that
 *   this is an elevated-privilege operation just from the path.
 * ============================================================
 */

/*
 * GET /api/admin/records/:user_id
 * WHY : Admin audit view — all records for any user including soft-deleted.
 *       Normal GET /api/records only returns the requester's own non-deleted
 *       records. This is a different operation with different security rules.
 * SECURITY: attach_user verifies JWT → require_role blocks non-admins at 403
 *           before the controller or model ever runs.
 * QUERY: ?page=1&limit=20 (default limit 20 — wider admin tables benefit
 *        from more rows per page vs the user-facing default of 10)
 */
router.get(
    '/admin/records/:user_id',
    attach_user,
    require_role(['ADMIN']),
    admin_controller.audit_records
);

/*
 * GET /api/admin/dashboard
 * WHY : Admin panel overview tab — operational health metrics for today.
 *       Returns user counts, record activity, AI usage, and cache hit ratio.
 *       NOT financial totals — those live at GET /api/analytics/system.
 * SECURITY: attach_user + require_role(['ADMIN']) — same middleware chain
 *           as all admin routes.
 * QUERY: none — always returns current-day stats
 */
router.get(
    '/admin/dashboard',
    attach_user,
    require_role(['ADMIN']),
    admin_controller.dashboard_stats
);

module.exports = router;