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

module.exports = router;