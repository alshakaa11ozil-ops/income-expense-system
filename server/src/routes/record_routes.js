/*
 * ============================================================
 * FILE    : record_routes.js
 * LAYER   : Route
 * PURPOSE : Map HTTP endpoints to record controller handlers
 * DEPENDS : src/controllers/record_controller.js,
 *           src/middleware/auth_middleware.js
 * ============================================================
 * EXPORTS:
 *   - router : Express router with all record routes
 * ============================================================
 *
 * ⚠️  CRITICAL ROUTE ORDER — do not rearrange.
 *     Express matches routes top-to-bottom. Static paths (/export,
 *     /deleted, /bulk) MUST come before the dynamic /:id param or
 *     Express will treat "export" and "deleted" as record IDs.
 */

const express = require('express');
const router = express.Router();
const record_controller = require('../controllers/record_controller');
const { attach_user, require_role } = require('../middleware/auth_middleware');

const admin_guard = [attach_user, require_role(['ADMIN'])];

// ── Static routes FIRST (before any /:id routes) ──────────────────────────
// WHY: if these were below /:id, Express would match "export" as an id param
router.get('/records/export', attach_user, record_controller.export_csv);
router.get('/records/by-date', attach_user, record_controller.by_date);
router.get('/records/deleted', admin_guard, record_controller.list_deleted);
router.delete('/records/bulk', attach_user, record_controller.bulk_delete);

// ── Standard CRUD ──────────────────────────────────────────────────────────
router.post('/records', attach_user, record_controller.create);
router.get('/records', attach_user, record_controller.list);
// CRITICAL: must be BEFORE /:id — otherwise Express matches "generate-id" as a record ID param
router.get('/records/generate-id', attach_user, record_controller.generate_id);
// ── Dynamic :id routes LAST ────────────────────────────────────────────────
router.get('/records/:id', attach_user, record_controller.get_one);
router.put('/records/:id', attach_user, record_controller.update);
router.delete('/records/:id', attach_user, record_controller.delete_one);

// admin-only record operations
router.post('/records/:id/restore', admin_guard, record_controller.restore);
router.delete('/records/:id/hard', admin_guard, record_controller.hard_delete);

module.exports = router;