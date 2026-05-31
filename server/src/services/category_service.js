/*
 * ============================================================
 * FILE    : category_service.js
 * LAYER   : Service
 * PURPOSE : Business logic for two-tier category management
 * DEPENDS : src/models/category_model.js
 * ============================================================
 * EXPORTS:
 *   - get_categories_for_user    : dropdown (system + user's own)
 *   - get_system_categories      : admin view of system categories
 *   - get_user_categories        : user's own categories only
 *   - create_system_category     : admin only
 *   - create_user_category       : any authenticated user
 *   - update_system_category     : admin only
 *   - update_user_category       : owner only
 *   - deactivate_system_category : admin only (soft)
 *   - delete_user_category       : owner only (hard, if no active records)
 * ============================================================
 */

// ARCHITECTURE GUARD: This file must never import PrismaClient.
// All DB access goes through functions in src/models/category_model.js only.

const category_model = require('../models/category_model');

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/*
 * FUNCTION : validate_fields
 * ─────────────────────────────────────────────────────────
 * WHY      : Shared validation for create and update operations.
 *            Centralising it prevents drift between the two paths.
 * HOW      : Check name length, color regex, icon presence.
 * @param   {object} data - { name?, icon?, color? }
 * @param   {boolean} require_all - true on create, false on update
 * @throws  {Error}
 * ─────────────────────────────────────────────────────────
 */
function validate_fields({ name, icon, color }, require_all = false) {
    if (name !== undefined || require_all) {
        if (!name || name.trim().length < 2) {
            throw new Error('Category name must be at least 2 characters');
        }
    }
    if (color !== undefined || require_all) {
        if (!color || !HEX_COLOR_REGEX.test(color)) {
            throw new Error('Color must be a valid hex color (e.g. #F59E0B or #FFF)');
        }
    }
    if (icon !== undefined || require_all) {
        if (!icon || icon.trim().length === 0) {
            throw new Error('Icon is required');
        }
    }
}

/*
 * FUNCTION : get_categories_for_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Powers the record form dropdown.
 *            Returns active system categories and all of the
 *            user's personal categories merged into one list.
 *
 * HOW      : Delegates entirely to model — the OR query handles merging.
 *
 * @param   {string} user_id
 * @returns {Category[]}
 * ─────────────────────────────────────────────────────────
 */
async function get_categories_for_user(user_id) {
    return category_model.find_active_for_user(user_id);
}

/*
 * FUNCTION : get_system_categories
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin panel shows all system categories including inactive.
 *
 * @returns {Category[]} - with record counts
 * ─────────────────────────────────────────────────────────
 */
async function get_system_categories() {
    return category_model.find_all_system();
}

/*
 * FUNCTION : get_user_categories
 * ─────────────────────────────────────────────────────────
 * WHY      : User management page — show a user their own custom categories.
 *
 * @param   {string} user_id
 * @returns {Category[]}
 * ─────────────────────────────────────────────────────────
 */
async function get_user_categories(user_id) {
    return category_model.find_all_by_user(user_id);
}

/*
 * FUNCTION : create_system_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin adds a system category available to all users.
 *
 * HOW      : 1. Validate all fields (name, icon, color)
 *            2. Check for duplicate across system + all users
 *               (a user having "Food" shouldn't block admin creating "Food"
 *               as system — but admin creating duplicate system name should block)
 *               So we check only among system categories (user_id = null).
 *            3. create_system
 *
 * @param   {string} admin_id
 * @param   {object} data - { name, icon, color }
 * @returns {Category}
 * @throws  {Error}
 * ─────────────────────────────────────────────────────────
 */
async function create_system_category(admin_id, data) {
    validate_fields(data, true);
    const { name, icon, color } = data;

    // pass null as user_id so dup-check only scans system categories
    const existing = await category_model.find_by_name_for_user(name.trim(), null);
    if (existing && existing.user_id === null) {
        throw new Error(`System category "${name.trim()}" already exists`);
    }

    return category_model.create_system(name.trim(), icon.trim(), color, admin_id);
}

/*
 * FUNCTION : create_user_category
 * ─────────────────────────────────────────────────────────
 * WHY      : User adds a personal category visible only to them.
 *
 * HOW      : 1. Validate fields
 *            2. Check for duplicate across system + this user's categories
 *               WHY: prevents creating "Food" if system already has "Food"
 *               — using a duplicate name would cause confusion in the dropdown
 *            3. create_user_category
 *
 * @param   {string} user_id
 * @param   {object} data - { name, icon, color }
 * @returns {Category}
 * @throws  {Error}
 * ─────────────────────────────────────────────────────────
 */
async function create_user_category(user_id, data) {
    validate_fields(data, true);
    const { name, icon, color } = data;

    const existing = await category_model.find_by_name_for_user(name.trim(), user_id);
    if (existing) {
        throw new Error(`Category "${name.trim()}" already exists`);
    }

    return category_model.create_user_category(user_id, name.trim(), icon.trim(), color);
}

/*
 * FUNCTION : update_system_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin corrects a system category.
 *            Users cannot call this — routes guard by role.
 *
 * HOW      : 1. Verify category exists and is a system category
 *            2. Validate provided fields
 *            3. Duplicate name check among system categories only
 *            4. update_system
 *
 * @param   {string} category_id
 * @param   {object} data
 * @returns {Category}
 * @throws  {Error}
 * ─────────────────────────────────────────────────────────
 */
async function update_system_category(category_id, data) {
    const existing = await category_model.find_by_id(category_id);
    if (!existing) throw new Error('Category not found');
    if (existing.user_id !== null) throw new Error('This is a user category — admins cannot edit it');

    // strip fields that must not change
    const { id: _id, user_id: _uid, created_by: _cb, ...safe_data } = data;

    validate_fields(safe_data, false);

    if (safe_data.name) {
        safe_data.name = safe_data.name.trim();
        const dup = await category_model.find_by_name_for_user(safe_data.name, null, category_id);
        if (dup && dup.user_id === null) {
            throw new Error(`System category "${safe_data.name}" already exists`);
        }
    }

    if (safe_data.icon) safe_data.icon = safe_data.icon.trim();

    return category_model.update_system(category_id, safe_data);
}

/*
 * FUNCTION : update_user_category
 * ─────────────────────────────────────────────────────────
 * WHY      : User corrects their own category.
 *            System categories are off-limits.
 *
 * HOW      : 1. Verify category exists and belongs to this user
 *            2. Validate provided fields
 *            3. Duplicate name check across system + this user's categories
 *            4. update_user_category
 *
 * @param   {string} category_id
 * @param   {string} user_id
 * @param   {object} data
 * @returns {Category}
 * @throws  {Error}
 * ─────────────────────────────────────────────────────────
 */
async function update_user_category(category_id, user_id, data) {
    const existing = await category_model.find_by_id(category_id);
    if (!existing) throw new Error('Category not found');
    if (existing.user_id !== user_id) throw new Error('You can only edit your own categories');

    const { id: _id, user_id: _uid, created_by: _cb, ...safe_data } = data;

    validate_fields(safe_data, false);

    if (safe_data.name) {
        safe_data.name = safe_data.name.trim();
        const dup = await category_model.find_by_name_for_user(safe_data.name, user_id, category_id);
        if (dup) throw new Error(`Category "${safe_data.name}" already exists`);
    }

    if (safe_data.icon) safe_data.icon = safe_data.icon.trim();

    return category_model.update_user_category(category_id, user_id, safe_data);
}

/*
 * FUNCTION : deactivate_system_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin hides a system category from the dropdown.
 *            Hard delete is impossible — existing records FK to it.
 *
 * HOW      : 1. Verify it's a system category
 *            2. Count active records — throw if > 0
 *            3. soft_deactivate_system
 *
 * @param   {string} category_id
 * @returns {Category}
 * @throws  {Error} if active records exist
 * ─────────────────────────────────────────────────────────
 */
async function deactivate_system_category(category_id) {
    const existing = await category_model.find_by_id(category_id);
    if (!existing) throw new Error('Category not found');
    if (existing.user_id !== null) throw new Error('This is a user category — use delete instead');

    const active_count = await category_model.count_active_records(category_id);
    if (active_count > 0) {
        throw new Error(
            `Cannot deactivate — ${active_count} active record${active_count !== 1 ? 's' : ''} use this category`
        );
    }

    return category_model.soft_deactivate_system(category_id);
}

/*
 * FUNCTION : delete_user_category
 * ─────────────────────────────────────────────────────────
 * WHY      : User permanently removes their own custom category.
 *            Allowed only if no active records reference it —
 *            otherwise the FK would break or orphan records.
 *
 * HOW      : 1. Verify it belongs to this user (not system)
 *            2. Count active records — throw if > 0
 *            3. Hard delete
 *
 * @param   {string} category_id
 * @param   {string} user_id
 * @returns {Category}
 * @throws  {Error}
 * ─────────────────────────────────────────────────────────
 */
async function delete_user_category(category_id, user_id) {
    const existing = await category_model.find_by_id(category_id);
    if (!existing) throw new Error('Category not found');
    if (existing.user_id !== user_id) throw new Error('You can only delete your own categories');

    const active_count = await category_model.count_active_records(category_id);
    if (active_count > 0) {
        throw new Error(
            `Cannot delete — ${active_count} active record${active_count !== 1 ? 's' : ''} use this category`
        );
    }

    return category_model.delete_user_category(category_id, user_id);
}

module.exports = {
    get_categories_for_user,
    get_system_categories,
    get_user_categories,
    create_system_category,
    create_user_category,
    update_system_category,
    update_user_category,
    deactivate_system_category,
    delete_user_category,
};