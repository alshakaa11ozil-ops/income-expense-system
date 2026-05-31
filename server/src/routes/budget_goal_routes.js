/*
 * ============================================================
 * FILE    : budget_goal_routes.js
 * LAYER   : Route
 * PURPOSE : Map HTTP endpoints to budget goal controller handlers
 * DEPENDS : src/controllers/budget_goal_controller.js,
 *           src/middleware/auth_middleware.js
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const budget_goal_controller = require('../controllers/budget_goal_controller');
const { attach_user } = require('../middleware/auth_middleware');

// Expose the write window so the frontend knows which months are editable
// Static route BEFORE /:id to avoid Express treating "window" as a goal id
router.get('/budget-goals/window', attach_user, budget_goal_controller.get_write_window);

router.get('/budget-goals', attach_user, budget_goal_controller.get_goals);

// WHY PUT: replacing or merging the full plan for a month
router.put('/budget-goals', attach_user, budget_goal_controller.save_goals);

// month + year passed as query params so service can enforce write window
// DELETE /api/budget-goals/:id?month=5&year=2026
router.delete('/budget-goals/:id', attach_user, budget_goal_controller.delete_goal);

module.exports = router;