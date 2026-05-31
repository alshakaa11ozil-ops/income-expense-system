/*
 * ============================================================
 * FILE    : analytics_routes.js
 * LAYER   : Route
 * PURPOSE : Maps analytics HTTP endpoints to controller handlers.
 *           All routes require authentication — anonymous users cannot
 *           access financial data. The system route additionally
 *           requires the ADMIN role.
 * DEPENDS : express, src/middleware/auth_middleware.js,
 *           src/controllers/analytics_controller.js
 * ============================================================
 * EXPORTS:
 *   - router : Express Router with all analytics routes mounted
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const analytics_controller = require('../controllers/analytics_controller');
const { attach_user, require_role } = require('../middleware/auth_middleware');

/*
 * GET /api/analytics/summary
 * ─────────────────────────────────────────────────────────
 * WHY      : Returns total income, total expense, and net balance
 *            for a given month. Drives the three summary cards on
 *            the dashboard.
 *
 * QUERY    : ?month=5&year=2026
 *            Defaults to current calendar month and year if omitted.
 *
 * MIDDLEWARE: attach_user — verifies JWT and populates req.user
 * ─────────────────────────────────────────────────────────
 */
router.get(
    '/analytics/summary',
    attach_user,
    analytics_controller.summary
);

/*
 * GET /api/analytics/trends
 * ─────────────────────────────────────────────────────────
 * WHY      : Returns income and expense totals grouped by month for
 *            the last N months. Drives the line chart on the dashboard.
 *            The AI service also calls this with months_back=3.
 *
 * QUERY    : ?months_back=6
 *            Defaults to 6 months if omitted.
 *
 * MIDDLEWARE: attach_user
 * ─────────────────────────────────────────────────────────
 */
router.get(
    '/analytics/trends',
    attach_user,
    analytics_controller.trends
);

/*
 * GET /api/analytics/categories
 * ─────────────────────────────────────────────────────────
 * WHY      : Returns expense totals grouped by category for a given
 *            month, with percentages. Drives the pie chart and budget
 *            goal progress bars.
 *
 * QUERY    : ?month=5&year=2026
 *            Defaults to current calendar month and year if omitted.
 *
 * MIDDLEWARE: attach_user
 * ─────────────────────────────────────────────────────────
 */
router.get(
    '/analytics/categories',
    attach_user,
    analytics_controller.categories
);

/*
 * GET /api/analytics/daily
 * ─────────────────────────────────────────────────────────
 * WHY      : Returns a running balance for each calendar day in a
 *            specified date range. Drives the detailed balance chart.
 *            Maximum range: 365 days (enforced in service).
 *
 * QUERY    : ?date_from=2026-05-01&date_to=2026-05-31
 *            Both params are required — service throws 400 if either is missing.
 *
 * MIDDLEWARE: attach_user
 * ─────────────────────────────────────────────────────────
 */
router.get(
    '/analytics/daily',
    attach_user,
    analytics_controller.daily_balance
);

/*
 * GET /api/analytics/system
 * ─────────────────────────────────────────────────────────
 * WHY      : Returns platform-wide totals across ALL users for the
 *            admin panel health view. Regular users must never access
 *            aggregated data from other users' records.
 *
 * QUERY    : none — no date filter, covers all-time totals
 *
 * MIDDLEWARE: attach_user → require_role(['ADMIN'])
 *             A USER hitting this route receives 403 before the
 *             controller or service is ever invoked.
 * ─────────────────────────────────────────────────────────
 */
router.get(
    '/analytics/system',
    attach_user,
    require_role(['ADMIN']),
    analytics_controller.system_summary
);

module.exports = router;