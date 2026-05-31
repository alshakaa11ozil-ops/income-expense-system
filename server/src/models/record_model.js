/*
 * ============================================================
 * FILE    : record_model.js
 * LAYER   : Model
 * PURPOSE : All Prisma queries for the Record table
 * DEPENDS : src/config/database.js (Prisma singleton)
 * ============================================================
 * EXPORTS:
 *   - find_by_id_any                : lookup ignoring soft-delete (dup-check only)
 *   - find_by_id                    : ownership-checked active record lookup
 *   - find_many                     : paginated list with filters
 *   - find_by_date_range            : date-filtered paginated list
 *   - find_by_category_and_date_range : for budget goal spending calc
 *   - find_deleted                  : admin audit — soft-deleted records
 *   - create                        : insert new record
 *   - update                        : update active record
 *   - soft_delete                   : set deleted_at (user action)
 *   - bulk_soft_delete              : soft-delete multiple records at once
 *   - restore                       : admin — clear deleted_at
 *   - hard_delete                   : admin — permanent removal
 *   - find_all_for_export           : all matching records for CSV, no pagination
 * ============================================================
 */

const prisma = require('../config/database');

// always join category on record queries so controllers never need a second trip
const CATEGORY_JOIN = {
    category: { select: { id: true, name: true, icon: true, color: true } },
};

/*
 * FUNCTION : find_by_id_any
 * ─────────────────────────────────────────────────────────
 * WHY      : Used ONLY for the duplicate ID check in create_record.
 *            Must look at ALL records regardless of soft-delete status.
 *            A soft-deleted record with the same ID must still
 *            block re-creation to protect the audit trail.
 *            BUG AVOIDED: do NOT include deleted_at: null here.
 *
 * HOW      : prisma.record.findUnique where id ONLY (no deleted_at filter)
 *
 * @param   {string} record_id
 * @returns {Record|null}
 * ─────────────────────────────────────────────────────────
 */
async function find_by_id_any(record_id) {
    return prisma.record.findUnique({
        where: { id: record_id },
    });
}

/*
 * FUNCTION : find_by_id
 * ─────────────────────────────────────────────────────────
 * WHY      : Standard ownership-checked lookup for edit, delete, get one.
 *            Includes soft-delete filter — users cannot access deleted records.
 *
 * HOW      : prisma.record.findUnique
 *            where: { id: record_id, user_id, deleted_at: null }
 *            include: { category: { select: { id, name, icon, color } } }
 *
 * @param   {string} record_id
 * @param   {string} user_id
 * @returns {Record|null} - with category joined
 * ─────────────────────────────────────────────────────────
 */
async function find_by_id(record_id, user_id) {
    return prisma.record.findUnique({
        where: { id: record_id, user_id, deleted_at: null },
        include: CATEGORY_JOIN,
    });
}

/*
 * FUNCTION : find_many
 * ─────────────────────────────────────────────────────────
 * WHY      : Powers the records list page with search, filter, pagination.
 *            Teacher explicitly requires: search by record_id, type, category
 *            with server-side pagination.
 *
 * HOW      : 1. Build where clause: user_id (always), deleted_at: null (always)
 *            2. Add optional filters: id contains, type exact, category_id exact
 *            3. prisma.$transaction([findMany + count]) for atomic pagination
 *            4. include category join on every row
 *
 * @param   {string} user_id
 * @param   {object} filters - { record_id?, type?, category_id? }
 * @param   {number} skip
 * @param   {number} take
 * @returns {[Record[], number]} - [rows, total count]
 * ─────────────────────────────────────────────────────────
 */
async function find_many(user_id, filters, skip, take) {
    const where = {
        user_id,
        deleted_at: null,
        // partial match on record id — useful for searching "INV-" prefix patterns
        ...(filters.record_id && { id: { contains: filters.record_id, mode: 'insensitive' } }),
        ...(filters.type && { type: filters.type }),
        ...(filters.category_id && { category_id: filters.category_id }),
    };

    const [rows, total] = await prisma.$transaction([
        prisma.record.findMany({
            where,
            include: CATEGORY_JOIN,
            orderBy: { date: 'desc' },
            skip,
            take,
        }),
        prisma.record.count({ where }),
    ]);

    return [rows, total];
}

/*
 * FUNCTION : find_by_date_range
 * ─────────────────────────────────────────────────────────
 * WHY      : Allows users to filter records between two dates.
 *            Extends the search feature with date range support.
 *
 * HOW      : where: { user_id, deleted_at: null,
 *                     date: { gte: date_from, lte: date_to } }
 *
 * @param   {string} user_id
 * @param   {Date}   date_from
 * @param   {Date}   date_to
 * @param   {number} skip
 * @param   {number} take
 * @returns {[Record[], number]}
 * ─────────────────────────────────────────────────────────
 */
async function find_by_date_range(user_id, date_from, date_to, skip, take) {
    const where = {
        user_id,
        deleted_at: null,
        date: { gte: date_from, lte: date_to },
    };

    const [rows, total] = await prisma.$transaction([
        prisma.record.findMany({
            where,
            include: CATEGORY_JOIN,
            orderBy: { date: 'desc' },
            skip,
            take,
        }),
        prisma.record.count({ where }),
    ]);

    return [rows, total];
}

/*
 * FUNCTION : find_by_category_and_date_range
 * ─────────────────────────────────────────────────────────
 * WHY      : Budget goal service needs actual expense totals per category
 *            per month to calculate the "spent vs goal" progress bars.
 *
 * HOW      : where: { user_id, category_id, type: expense,
 *                     deleted_at: null, date: { gte, lte } }
 *
 * @param   {string} user_id
 * @param   {string} category_id
 * @param   {Date}   date_from
 * @param   {Date}   date_to
 * @returns {Record[]} - amount fields only needed for summation
 * ─────────────────────────────────────────────────────────
 */
async function find_by_category_and_date_range(user_id, category_id, date_from, date_to) {
    return prisma.record.findMany({
        where: {
            user_id,
            category_id,
            type: 'expense',
            deleted_at: null,
            date: { gte: date_from, lte: date_to },
        },
        select: { amount: true },
    });
}

/*
 * FUNCTION : find_deleted
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin audit view — shows soft-deleted records.
 *            Opposite of normal queries: we WANT deleted_at IS NOT NULL.
 *
 * HOW      : where: { deleted_at: { not: null } }
 *            if user_id provided: add user_id filter
 *            if user_id is null: return all deleted records (admin system view)
 *
 * @param   {string|null} user_id - null means all users (admin only)
 * @returns {Record[]} - with category and user joined
 * ─────────────────────────────────────────────────────────
 */
async function find_deleted(user_id) {
    return prisma.record.findMany({
        where: {
            deleted_at: { not: null },
            // when user_id is provided scope to that user; null = all users for system audit
            ...(user_id && { user_id }),
        },
        include: {
            ...CATEGORY_JOIN,
            user: { select: { id: true, username: true, email: true } },
        },
        orderBy: { deleted_at: 'desc' },
    });
}

/*
 * FUNCTION : create
 * ─────────────────────────────────────────────────────────
 * WHY      : Inserts a new record. All validation already done in service.
 *
 * HOW      : prisma.record.create with data, return with category joined
 *
 * @param   {object} data
 * @returns {Record} - with category
 * ─────────────────────────────────────────────────────────
 */
async function create(data) {
    return prisma.record.create({
        data,
        include: CATEGORY_JOIN,
    });
}

/*
 * FUNCTION : update
 * ─────────────────────────────────────────────────────────
 * WHY      : Updates an existing active record. ID never changes.
 *
 * HOW      : prisma.record.update
 *            where: { id, user_id, deleted_at: null }
 *            data: fields (id is never in data — stripped in service)
 *            return with category joined
 *
 * @param   {string} record_id
 * @param   {string} user_id
 * @param   {object} data
 * @returns {Record}
 * ─────────────────────────────────────────────────────────
 */
async function update(record_id, user_id, data) {
    return prisma.record.update({
        where: { id: record_id, user_id, deleted_at: null },
        data,
        include: CATEGORY_JOIN,
    });
}

/*
 * FUNCTION : soft_delete
 * ─────────────────────────────────────────────────────────
 * WHY      : Users can only soft-delete. Financial records must
 *            be preserved for audit purposes.
 *
 * HOW      : prisma.record.update
 *            where: { id, user_id, deleted_at: null }
 *            data: { deleted_at: new Date(), deleted_by: user_id }
 *
 * @param   {string} record_id
 * @param   {string} user_id
 * @returns {Record}
 * ─────────────────────────────────────────────────────────
 */
async function soft_delete(record_id, user_id) {
    return prisma.record.update({
        where: { id: record_id, user_id, deleted_at: null },
        data: { deleted_at: new Date(), deleted_by: user_id },
    });
}

/*
 * FUNCTION : bulk_soft_delete
 * ─────────────────────────────────────────────────────────
 * WHY      : User selects multiple records and deletes them at once.
 *
 * HOW      : prisma.record.updateMany
 *            where: { id: { in: id_array }, user_id, deleted_at: null }
 *            data: { deleted_at: new Date(), deleted_by: user_id }
 *
 * @param   {string[]} id_array
 * @param   {string}   user_id
 * @returns {number} - count of updated rows
 * ─────────────────────────────────────────────────────────
 */
async function bulk_soft_delete(id_array, user_id) {
    const result = await prisma.record.updateMany({
        where: { id: { in: id_array }, user_id, deleted_at: null },
        data: { deleted_at: new Date(), deleted_by: user_id },
    });
    return result.count;
}

/*
 * FUNCTION : restore
 * ─────────────────────────────────────────────────────────
 * WHY      : ADMIN ONLY — restores a soft-deleted record.
 *
 * HOW      : prisma.record.update
 *            where: { id } ← no user_id filter — admin can restore any
 *            data: { deleted_at: null, deleted_by: null }
 *
 * @param   {string} record_id
 * @returns {Record}
 * ─────────────────────────────────────────────────────────
 */
async function restore(record_id) {
    return prisma.record.update({
        where: { id: record_id },
        data: { deleted_at: null, deleted_by: null },
        include: CATEGORY_JOIN,
    });
}

/*
 * FUNCTION : hard_delete
 * ─────────────────────────────────────────────────────────
 * WHY      : ADMIN ONLY — permanently removes a record.
 *            Irreversible. Should only be used after careful confirmation.
 *
 * HOW      : prisma.record.delete where id = record_id
 *
 * @param   {string} record_id
 * @returns {Record} - the deleted record data (for confirmation display)
 * ─────────────────────────────────────────────────────────
 */
async function hard_delete(record_id) {
    return prisma.record.delete({
        where: { id: record_id },
    });
}

/*
 * FUNCTION : find_all_for_export
 * ─────────────────────────────────────────────────────────
 * WHY      : CSV export needs ALL matching records with no pagination.
 *            Reuses same filters as find_many but without skip/take.
 *
 * HOW      : prisma.record.findMany same where clause, no skip/take
 *            include category
 *            order by date desc
 *
 * @param   {string} user_id
 * @param   {object} filters
 * @returns {Record[]}
 * ─────────────────────────────────────────────────────────
 */
async function find_all_for_export(user_id, filters) {
    const where = {
        user_id,
        deleted_at: null,
        ...(filters.record_id && { id: { contains: filters.record_id, mode: 'insensitive' } }),
        ...(filters.type && { type: filters.type }),
        ...(filters.category_id && { category_id: filters.category_id }),
    };

    return prisma.record.findMany({
        where,
        include: CATEGORY_JOIN,
        orderBy: { date: 'desc' },
    });
}

module.exports = {
    find_by_id_any,
    find_by_id,
    find_many,
    find_by_date_range,
    find_by_category_and_date_range,
    find_deleted,
    create,
    update,
    soft_delete,
    bulk_soft_delete,
    restore,
    hard_delete,
    find_all_for_export,
};