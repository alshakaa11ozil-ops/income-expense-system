/*
 * ============================================================
 * FILE    : category_controller.js
 * LAYER   : Controller
 * PURPOSE : Parse requests and dispatch to category_service
 * DEPENDS : src/services/category_service.js,
 *           src/utils/api_response.js
 * ============================================================
 * EXPORTS:
 *   - get_for_user           : dropdown (system + own)
 *   - get_system_all         : admin — all system categories
 *   - get_user_own           : user's own categories
 *   - create_system          : admin create system category
 *   - create_user            : user create personal category
 *   - update_system          : admin update system category
 *   - update_user            : user update own category
 *   - deactivate_system      : admin soft-deactivate system category
 *   - delete_user            : user hard-delete own category
 * ============================================================
 */

const category_service = require('../services/category_service');
const { send_success, send_error } = require('../utils/api_response');

async function get_for_user(req, res) {
    try {
        const data = await category_service.get_categories_for_user(req.user.id);
        return send_success(res, data);
    } catch (err) {
        return send_error(res, err.message, 500);
    }
}

async function get_system_all(req, res) {
    try {
        const data = await category_service.get_system_categories();
        return send_success(res, data);
    } catch (err) {
        return send_error(res, err.message, 500);
    }
}

async function get_user_own(req, res) {
    try {
        const data = await category_service.get_user_categories(req.user.id);
        return send_success(res, data);
    } catch (err) {
        return send_error(res, err.message, 500);
    }
}

async function create_system(req, res) {
    try {
        const cat = await category_service.create_system_category(req.user.id, req.body);
        return send_success(res, cat, 201);
    } catch (err) {
        const status = err.message.includes('already exists') ? 409 : 400;
        return send_error(res, err.message, status);
    }
}

async function create_user(req, res) {
    try {
        const cat = await category_service.create_user_category(req.user.id, req.body);
        return send_success(res, cat, 201);
    } catch (err) {
        const status = err.message.includes('already exists') ? 409 : 400;
        return send_error(res, err.message, status);
    }
}

async function update_system(req, res) {
    try {
        const cat = await category_service.update_system_category(req.params.id, req.body);
        return send_success(res, cat);
    } catch (err) {
        const status = err.message === 'Category not found' ? 404 : 400;
        return send_error(res, err.message, status);
    }
}

async function update_user(req, res) {
    try {
        const cat = await category_service.update_user_category(req.params.id, req.user.id, req.body);
        return send_success(res, cat);
    } catch (err) {
        const status = err.message === 'Category not found' ? 404 : 400;
        return send_error(res, err.message, status);
    }
}

async function deactivate_system(req, res) {
    try {
        const cat = await category_service.deactivate_system_category(req.params.id);
        return send_success(res, cat);
    } catch (err) {
        const status = err.message === 'Category not found' ? 404 : 409;
        return send_error(res, err.message, status);
    }
}

async function delete_user(req, res) {
    try {
        const cat = await category_service.delete_user_category(req.params.id, req.user.id);
        return send_success(res, cat);
    } catch (err) {
        const status = err.message === 'Category not found' ? 404 : 409;
        return send_error(res, err.message, status);
    }
}

module.exports = {
    get_for_user, get_system_all, get_user_own,
    create_system, create_user,
    update_system, update_user,
    deactivate_system, delete_user,
};