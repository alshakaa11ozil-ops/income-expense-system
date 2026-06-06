/*
 * ============================================================
 * FILE    : ai_routes.js
 * LAYER   : Route
 * PURPOSE : Maps all AI HTTP endpoints to their controller handlers.
 *           All routes require authentication — anonymous users cannot
 *           access AI features. Admin-only routes additionally enforce
 *           role checking via require_role middleware.
 * DEPENDS : express, middleware/auth_middleware, controllers/ai_controller
 * ============================================================
 * EXPORTS:
 *   - router  : Express Router with all AI routes mounted
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const ai_controller = require('../controllers/ai_controller');
const {
    attach_user,
    require_role,
} = require('../middleware/auth_middleware');

/*
 * POST /api/ai/plan
 * WHY  : Budget Planner tab — user sets a target budget and month,
 *        AI suggests how to allocate it across spending categories.
 * AUTH : Any authenticated user (USER or ADMIN)
 * BODY : { target_budget: "2500.00", month: 6, year: 2026 }
 */
router.post(
    '/ai/plan',
    attach_user,
    ai_controller.plan
);

/*
 * POST /api/ai/advise
 * WHY  : Purchase Advisor tab — user describes a planned purchase,
 *        AI returns a can_afford / wait / adjust_spending verdict.
 * AUTH : Any authenticated user
 * BODY : { item_name: "Laptop", item_cost: "1200.00", planned_date: "2026-06-15" }
 */
router.post(
    '/ai/advise',
    attach_user,
    ai_controller.advise
);

/*
 * POST /api/ai/analyze
 * WHY  : Finance Chat tab — free-form Q&A about the user's finances.
 *        More open-ended than plan/advise; handles any financial question.
 * AUTH : Any authenticated user
 * BODY : { question: "What is my biggest expense category?" }
 */
router.post(
    '/ai/analyze',
    attach_user,
    ai_controller.analyze
);

/*
 * GET /api/ai/usage
 * WHY  : Shows the requesting user their remaining daily AI requests.
 *        Displayed in the AiAssistantPage header so users know their
 *        limit before they unexpectedly hit a 429 response.
 * AUTH : Any authenticated user
 * RETURNS: { non_cached_today, cached_today, daily_limit, remaining }
 */
router.get(
    '/ai/usage',
    attach_user,
    ai_controller.get_usage
);

/*
 * GET /api/ai/usage/all
 * WHY  : Admin report showing usage across all users — which features
 *        are most used, cache hit rates, token consumption.
 *        Must be ADMIN-only: exposes usage data for every user.
 * AUTH : ADMIN role required
 * QUERY: ?days_back=7  (default 7, pass 30 for monthly view)
 */
router.get(
    '/ai/usage/all',
    attach_user,
    require_role(['ADMIN']),
    ai_controller.get_all_usage
);

module.exports = router;