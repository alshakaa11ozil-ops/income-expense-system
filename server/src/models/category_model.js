/*
 * ============================================================
 * FILE    : category_model.js
 * LAYER   : Model
 * PURPOSE : All Prisma queries for the Category table
 * DEPENDS : src/config/database.js (Prisma singleton)
 * ============================================================
 * EXPORTS:
 *   - find_active_for_user      : system categories + user's own (dropdown)
 *   - find_all_system           : admin — system-only categories
 *   - find_all_by_user          : user's personal categories only
 *   - find_by_id                : single category lookup
 *   - find_by_name_for_user     : dup-check scoped to user + system
 *   - create_system             : admin creates a system category
 *   - create_user_category      : user creates a personal category
 *   - update_system             : admin updates a system category
 *   - update_user_category      : user updates their own category
 *   - soft_deactivate_system    : admin deactivates system category
 *   - delete_user_category      : user hard-deletes their own category
 *   - count_active_records      : records using a category (for deactivation guard)
 * ============================================================
 */

const prisma = require('../config/database');

const CATEGORY_SELECT = { id: true, name: true, icon: true, color: true, user_id: true, is_active: true };

/*
 * FUNCTION : find_active_for_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Record form dropdown must show system categories
 *            (available to everyone) AND the user's own custom
 *            categories. Inactive system categories are hidden.
 *            A user's own category is always visible to them
 *            regardless of any "active" concept (user cats have no
 *            is_active — they are simply deleted when unwanted).
 *
 * HOW      : OR clause: (user_id IS NULL AND is_active = true)
 *                    OR (user_id = user_id)
 *            Ordered system-first then name asc so system categories
 *            appear at the top of the dropdown.
 *
 * @param   {string} user_id
 * @returns {Category[]}
 * ─────────────────────────────────────────────────────────
 */
async function find_active_for_user(user_id) {
    return prisma.category.findMany({
        where: {
            OR: [
                { user_id: null, is_active: true },  // system categories visible to all
                { user_id },                          // this user's personal categories
            ],
        },
        select: CATEGORY_SELECT,
        orderBy: [
            { user_id: 'asc' },   // nulls (system) sort first in postgres asc
            { name: 'asc' },
        ],
    });
}

/*
 * FUNCTION : find_all_system
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin panel needs all system categories including
 *            deactivated ones. Personal categories are managed
 *            by users themselves and are not the admin's concern.
 *
 * HOW      : where user_id IS NULL — system categories only.
 *            Include record count for each.
 *
 * @returns {Category[]} - with _count.records
 * ─────────────────────────────────────────────────────────
 */
async function find_all_system() {
    return prisma.category.findMany({
        where: { user_id: null },
        include: { _count: { select: { records: true } } },
        orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });
}

/*
 * FUNCTION : find_all_by_user
 * ─────────────────────────────────────────────────────────
 * WHY      : User management page — show a user their own categories.
 *
 * HOW      : where user_id = user_id, no is_active filter.
 *
 * @param   {string} user_id
 * @returns {Category[]}
 * ─────────────────────────────────────────────────────────
 */
async function find_all_by_user(user_id) {
    return prisma.category.findMany({
        where: { user_id },
        select: CATEGORY_SELECT,
        orderBy: { name: 'asc' },
    });
}

/*
 * FUNCTION : find_by_id
 * ─────────────────────────────────────────────────────────
 * WHY      : Validate a category exists before linking to a record.
 *            Ownership check (system vs user-owned) happens in service.
 *
 * @param   {string} category_id
 * @returns {Category|null}
 * ─────────────────────────────────────────────────────────
 */
async function find_by_id(category_id) {
    return prisma.category.findUnique({
        where: { id: category_id },
    });
}

/*
 * FUNCTION : find_by_name_for_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Duplicate name check scoped correctly.
 *            A user cannot create "Food" if a system category
 *            named "Food" already exists, and vice versa.
 *            The check covers: system + this user's own categories.
 *
 * HOW      : WHERE (user_id IS NULL OR user_id = user_id)
 *              AND name ILIKE name
 *              AND id != exclude_id (for update)
 *
 * @param   {string} name
 * @param   {string} user_id   - the requesting user
 * @param   {string} exclude_id - skip this id on update checks
 * @returns {Category|null}
 * ─────────────────────────────────────────────────────────
 */
async function find_by_name_for_user(name, user_id, exclude_id = null) {
    return prisma.category.findFirst({
        where: {
            name: { equals: name, mode: 'insensitive' },
            OR: [{ user_id: null }, { user_id }],
            ...(exclude_id && { id: { not: exclude_id } }),
        },
    });
}

/*
 * FUNCTION : create_system
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin creates a category visible to all users.
 *            user_id is null to mark it as a system category.
 *
 * @param   {string} name
 * @param   {string} icon
 * @param   {string} color
 * @param   {string} created_by - admin's user_id
 * @returns {Category}
 * ─────────────────────────────────────────────────────────
 */
async function create_system(name, icon, color, created_by) {
    return prisma.category.create({
        data: { name, icon, color, created_by, user_id: null },
    });
}

/*
 * FUNCTION : create_user_category
 * ─────────────────────────────────────────────────────────
 * WHY      : User creates a personal category visible only to them.
 *            user_id is set to the creating user's id.
 *
 * @param   {string} user_id
 * @param   {string} name
 * @param   {string} icon
 * @param   {string} color
 * @returns {Category}
 * ─────────────────────────────────────────────────────────
 */
async function create_user_category(user_id, name, icon, color) {
    return prisma.category.create({
        data: { name, icon, color, user_id, created_by: user_id, is_active: true },
    });
}

/*
 * FUNCTION : update_system
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin updates a system category.
 *            Guard: only categories with user_id IS NULL are updatable here.
 *
 * @param   {string} category_id
 * @param   {object} data - { name?, icon?, color? }
 * @returns {Category}
 * ─────────────────────────────────────────────────────────
 */
async function update_system(category_id, data) {
    return prisma.category.update({
        where: { id: category_id, user_id: null },
        data,
    });
}

/*
 * FUNCTION : update_user_category
 * ─────────────────────────────────────────────────────────
 * WHY      : User updates their own category.
 *            Guard: user_id in where clause prevents editing
 *            another user's category or a system category.
 *
 * @param   {string} category_id
 * @param   {string} user_id
 * @param   {object} data
 * @returns {Category}
 * ─────────────────────────────────────────────────────────
 */
async function update_user_category(category_id, user_id, data) {
    return prisma.category.update({
        where: { id: category_id, user_id },
        data,
    });
}

/*
 * FUNCTION : soft_deactivate_system
 * ─────────────────────────────────────────────────────────
 * WHY      : System categories cannot be hard-deleted because records
 *            FK to them. Deactivating hides them from the dropdown.
 *
 * @param   {string} category_id
 * @returns {Category}
 * ─────────────────────────────────────────────────────────
 */
async function soft_deactivate_system(category_id) {
    return prisma.category.update({
        where: { id: category_id, user_id: null },
        data: { is_active: false },
    });
}

/*
 * FUNCTION : delete_user_category
 * ─────────────────────────────────────────────────────────
 * WHY      : User hard-deletes their own category.
 *            Only safe if no active records reference it (checked in service).
 *            user_id guard in where prevents deleting system or other users' cats.
 *
 * @param   {string} category_id
 * @param   {string} user_id
 * @returns {Category}
 * ─────────────────────────────────────────────────────────
 */
async function delete_user_category(category_id, user_id) {
    return prisma.category.delete({
        where: { id: category_id, user_id },
    });
}

/*
 * FUNCTION : count_active_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Before deactivating or deleting a category, guard against
 *            orphaning active records that still reference it.
 *
 * @param   {string} category_id
 * @returns {number}
 * ─────────────────────────────────────────────────────────
 */
async function count_active_records(category_id) {
    return prisma.record.count({
        where: { category_id, deleted_at: null },
    });
}

/*
 * FUNCTION : find_many_by_ids
 * ─────────────────────────────────────────────────────────
 * WHY      : Batch fetch categories for analytics merge or bulk lookups.
 *            Efficiency: O(1) database trip instead of N trips.
 *
 * @param   {string[]} ids
 * @returns {Category[]}
 * ─────────────────────────────────────────────────────────
 */
async function find_many_by_ids(ids) {
    if (!ids || ids.length === 0) return [];
    return prisma.category.findMany({
        where: { id: { in: ids } },
        select: CATEGORY_SELECT,
    });
}

module.exports = {
    find_active_for_user,
    find_all_system,
    find_all_by_user,
    find_by_id,
    find_by_name_for_user,
    create_system,
    create_user_category,
    update_system,
    update_user_category,
    soft_deactivate_system,
    delete_user_category,
    count_active_records,
    find_many_by_ids,
};