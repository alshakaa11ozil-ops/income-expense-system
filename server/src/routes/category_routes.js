/*
 * ============================================================
 * FILE    : category_routes.js
 * LAYER   : Route
 * PURPOSE : Map HTTP endpoints for two-tier category system
 * DEPENDS : src/controllers/category_controller.js,
 *           src/middleware/auth_middleware.js
 * ============================================================
 * ROUTE DESIGN:
 *   /categories           — user-scoped (system + own, for dropdown)
 *   /categories/mine      — user's personal categories only
 *   /categories/mine/:id  — edit/delete own category
 *   /admin/categories     — system categories (admin only)
 *   /admin/categories/:id — edit/deactivate system category (admin only)
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const c = require('../controllers/category_controller');
const { attach_user, require_role } = require('../middleware/auth_middleware');

const admin_guard = [attach_user, require_role(['ADMIN'])];

// ── User routes ────────────────────────────────────────────
// Merged dropdown: active system categories + user's own
router.get('/categories', attach_user, c.get_for_user);

// User's own custom categories (manage page)
router.get('/categories/mine', attach_user, c.get_user_own);
router.post('/categories/mine', attach_user, c.create_user);
router.put('/categories/mine/:id', attach_user, c.update_user);
// Hard-delete: only user's own, only if no active records reference it
router.delete('/categories/mine/:id', attach_user, c.delete_user);

// ── Admin routes ───────────────────────────────────────────
// System categories — admin manages, users cannot touch
router.get('/admin/categories', admin_guard, c.get_system_all);
router.post('/admin/categories', admin_guard, c.create_system);
router.put('/admin/categories/:id', admin_guard, c.update_system);
// Soft-deactivate only — hard delete is impossible due to FK constraints
router.delete('/admin/categories/:id', admin_guard, c.deactivate_system);

module.exports = router;