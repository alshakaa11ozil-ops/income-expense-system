/*
 * ============================================================
 * FILE    : record_service.js
 * LAYER   : Service
 * PURPOSE : All business logic for income/expense record operations
 * DEPENDS : src/models/record_model.js,
 *           src/models/category_model.js,
 *           decimal.js
 * ============================================================
 * EXPORTS:
 *   - create_record         : validate + insert new record
 *   - get_records           : list with search, filter, pagination
 *   - get_record            : single record by id
 *   - update_record         : validate + update (id immutable)
 *   - delete_record         : soft delete
 *   - bulk_delete_records   : soft delete multiple
 *   - get_by_date_range     : date-filtered list
 *   - export_records        : all matching rows for CSV
 *   - get_deleted_records   : admin audit view
 *   - restore_record        : admin restore
 *   - hard_delete_record    : admin permanent delete
 * ============================================================
 */

// ARCHITECTURE GUARD: This file must never import PrismaClient.
// All DB access goes through functions in src/models/record_model.js only.

const Decimal = require('decimal.js');
const record_model = require('../models/record_model');
const category_model = require('../models/category_model');
const { get_pagination_params, format_paginated_response } = require('../utils/pagination');

const VALID_TYPES = ['income', 'expense'];
const MAX_BULK_DELETE = 100;

/*
 * FUNCTION : serialize_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Prisma returns Decimal objects for amount.
 *            Clients expect a plain string — never a JS Number.
 *            Centralising serialization prevents float leakage.
 * HOW      : Spread record, override amount with toFixed(2) string.
 * @param   {Record} record
 * @returns {object}
 * ─────────────────────────────────────────────────────────
 */
function serialize_record(record) {
    return {
        ...record,
        amount: new Decimal(record.amount).toFixed(2), // "1500.00" — string, not number
        category: record.category ?? null,
    };
}

/*
 * FUNCTION : validate_amount
 * ─────────────────────────────────────────────────────────
 * WHY      : Shared amount validation used by create and update.
 *            Throws descriptive errors on invalid input.
 * HOW      : Parse with Decimal (throws on NaN), check > 0.
 * @param   {*} amount
 * @returns {Decimal}
 * @throws  {Error} if not numeric or not positive
 * ─────────────────────────────────────────────────────────
 */
function validate_amount(amount) {
    let decimal_amount;
    try {
        decimal_amount = new Decimal(amount);
    } catch {
        throw new Error('Amount must be a valid number');
    }
    if (decimal_amount.lte(0)) {
        throw new Error('Amount must be greater than zero');
    }
    return decimal_amount;
}

/*
 * FUNCTION : validate_category
 * ─────────────────────────────────────────────────────────
 * WHY      : Shared category validation used by create and update.
 *            Category must exist and be active.
 * HOW      : find_by_id → check exists → check is_active.
 * @param   {string} category_id
 * @throws  {Error} if not found or deactivated
 * ─────────────────────────────────────────────────────────
 */
async function validate_category(category_id) {
    const category = await category_model.find_by_id(category_id);
    if (!category) {
        throw new Error('Category not found');
    }
    if (!category.is_active) {
        throw new Error('Category is deactivated — choose an active category');
    }
}

/*
 * FUNCTION : create_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — add a record with validation.
 *            Duplicate ID check must catch even soft-deleted records.
 *
 * HOW      : 1. Validate mandatory fields: id, type, amount, category_id,
 *               date, operator are all present and not empty strings
 *            2. Validate type is exactly 'income' or 'expense'
 *            3. Validate amount using validate_amount helper
 *            4. Validate date is a valid date string
 *            5. DUPLICATE CHECK — CRITICAL:
 *               call record_model.find_by_id_any(data.id)
 *               WHY: uses find_by_id_ANY so soft-deleted records
 *               with same ID also block creation
 *               if found → throw Error('Record ID already exists')
 *            6. Validate category_id via validate_category helper
 *            7. Call record_model.create(data)
 *
 * @param   {string} user_id
 * @param   {object} data
 * @returns {Record} - with category joined
 * @throws  {Error} on any validation failure
 * ─────────────────────────────────────────────────────────
 */
async function create_record(user_id, data) {
    const { id, type, amount, category_id, date, operator, notes } = data;

    // mandatory field presence check
    if (!id || String(id).trim() === '') throw new Error('Record ID is required');
    if (!type) throw new Error('Type is required');
    if (amount === undefined || amount === null || amount === '') throw new Error('Amount is required');
    if (!category_id) throw new Error('Category is required');
    if (!date) throw new Error('Date is required');
    if (!operator || String(operator).trim() === '') throw new Error('Operator is required');

    // type must be exactly one of the allowed values
    if (!VALID_TYPES.includes(type)) {
        throw new Error(`Type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // amount must be a positive decimal — throws internally on bad input
    validate_amount(amount);

    // date must parse to a real date
    const parsed_date = new Date(date);
    if (isNaN(parsed_date.getTime())) {
        throw new Error('Date must be a valid date (e.g. 2026-05-28)');
    }

    // CRITICAL: check ALL records, including soft-deleted, to protect audit trail
    const existing = await record_model.find_by_id_any(String(id).trim());
    if (existing) {
        throw new Error('Record ID already exists');
    }

    // validate category exists and is active
    await validate_category(category_id);

    return serialize_record(
        await record_model.create({
            id: String(id).trim(),
            type,
            amount,
            category_id,
            date: parsed_date,
            operator: String(operator).trim(),
            notes: notes ?? null,
            user_id,
        })
    );
}

/*
 * FUNCTION : get_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — list + search + filter + paginate.
 *            All four search fields must work together.
 *
 * HOW      : 1. Extract: record_id, type, category_id, page, limit from params
 *            2. Validate page >= 1, limit between 1-100, default 10
 *            3. Build filters object from provided params
 *            4. Calculate skip = (page - 1) * limit
 *            5. Call record_model.find_many
 *            6. Serialize amounts as strings
 *            7. Return with pagination object
 *
 * @param   {string} user_id
 * @param   {object} query_params
 * @returns {{ data: Record[], pagination: object }}
 * ─────────────────────────────────────────────────────────
 */
async function get_records(user_id, query_params) {
    const { skip, take, page, limit } = get_pagination_params(query_params);

    const filters = {
        ...(query_params.record_id && { record_id: query_params.record_id }),
        ...(query_params.type && { type: query_params.type }),
        ...(query_params.category_id && { category_id: query_params.category_id }),
    };

    const [rows, total] = await record_model.find_many(user_id, filters, skip, take);

    return format_paginated_response(rows.map(serialize_record), total, page, limit);
}

/*
 * FUNCTION : get_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Fetch a single record for the edit form or detail view.
 *
 * HOW      : 1. Call record_model.find_by_id(record_id, user_id)
 *            2. If null → throw Error('Record not found')
 *            3. Return with amount serialized as string
 *
 * @param   {string} user_id
 * @param   {string} record_id
 * @returns {Record}
 * @throws  {Error} if not found
 * ─────────────────────────────────────────────────────────
 */
async function get_record(user_id, record_id) {
    const record = await record_model.find_by_id(record_id, user_id);
    if (!record) throw new Error('Record not found');
    return serialize_record(record);
}

/*
 * FUNCTION : update_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — edit a record. ID must never change.
 *
 * HOW      : 1. CRITICAL: delete data.id before anything else
 *               WHY: prevents any possibility of ID change
 *            2. Validate any provided fields (type, amount, category_id)
 *            3. If category_id provided: validate it exists and is_active
 *            4. Confirm ownership: find_by_id(record_id, user_id)
 *            5. Call record_model.update
 *
 * @param   {string} user_id
 * @param   {string} record_id
 * @param   {object} data       - id field will be deleted before processing
 * @returns {Record}
 * @throws  {Error} if not found or validation fails
 * ─────────────────────────────────────────────────────────
 */
async function update_record(user_id, record_id, data) {
    // strip id immediately — record ID is immutable by design
    delete data.id;
    delete data.user_id; // user cannot reassign a record to another user

    if (data.type !== undefined && !VALID_TYPES.includes(data.type)) {
        throw new Error(`Type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    if (data.amount !== undefined) {
        validate_amount(data.amount);
    }

    if (data.date !== undefined) {
        const parsed_date = new Date(data.date);
        if (isNaN(parsed_date.getTime())) {
            throw new Error('Date must be a valid date (e.g. 2026-05-28)');
        }
        data.date = parsed_date;
    }

    if (data.category_id !== undefined) {
        await validate_category(data.category_id);
    }

    // ownership check — returns null if record is deleted or belongs to another user
    const existing = await record_model.find_by_id(record_id, user_id);
    if (!existing) throw new Error('Record not found');

    return serialize_record(await record_model.update(record_id, user_id, data));
}

/*
 * FUNCTION : delete_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — delete from list view.
 *            Soft delete only — user cannot permanently remove records.
 *
 * HOW      : 1. Confirm ownership via find_by_id
 *            2. Call record_model.soft_delete
 *
 * @param   {string} user_id
 * @param   {string} record_id
 * @returns {Record} - the soft-deleted record
 * ─────────────────────────────────────────────────────────
 */
async function delete_record(user_id, record_id) {
    const existing = await record_model.find_by_id(record_id, user_id);
    if (!existing) throw new Error('Record not found');

    const deleted = await record_model.soft_delete(record_id, user_id);
    return serialize_record(deleted);
}

/*
 * FUNCTION : bulk_delete_records
 * ─────────────────────────────────────────────────────────
 * WHY      : User selects multiple rows in the table and deletes at once.
 *
 * HOW      : 1. Validate id_array is a non-empty array
 *            2. Validate array length <= 100 (prevent abuse)
 *            3. Call record_model.bulk_soft_delete
 *            4. Return count of deleted records
 *
 * @param   {string}   user_id
 * @param   {string[]} id_array
 * @returns {{ deleted_count: number }}
 * ─────────────────────────────────────────────────────────
 */
async function bulk_delete_records(user_id, id_array) {
    if (!Array.isArray(id_array) || id_array.length === 0) {
        throw new Error('ids must be a non-empty array');
    }
    if (id_array.length > MAX_BULK_DELETE) {
        throw new Error(`Cannot bulk delete more than ${MAX_BULK_DELETE} records at once`);
    }

    const deleted_count = await record_model.bulk_soft_delete(id_array, user_id);
    return { deleted_count };
}

/*
 * FUNCTION : get_by_date_range
 * ─────────────────────────────────────────────────────────
 * WHY      : Date filtering for the records page and export feature.
 *
 * HOW      : 1. Parse date_from and date_to as Date objects
 *            2. Validate date_from <= date_to
 *            3. Call record_model.find_by_date_range
 *            4. Serialize amounts, return with pagination
 *
 * @param   {string} user_id
 * @param   {object} query_params - { date_from, date_to, page, limit }
 * @returns {{ data: Record[], pagination: object }}
 * ─────────────────────────────────────────────────────────
 */
async function get_by_date_range(user_id, query_params) {
    const { date_from, date_to } = query_params;

    if (!date_from || !date_to) {
        throw new Error('date_from and date_to are required');
    }

    const from = new Date(date_from);
    const to = new Date(date_to);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error('date_from and date_to must be valid dates');
    }

    // set time to end of day for date_to so it includes all records on that day
    to.setHours(23, 59, 59, 999);

    if (from > to) {
        throw new Error('date_from must be before or equal to date_to');
    }

    const { skip, take, page, limit } = get_pagination_params(query_params);

    const [rows, total] = await record_model.find_by_date_range(user_id, from, to, skip, take);

    return format_paginated_response(rows.map(serialize_record), total, page, limit);
}

/*
 * FUNCTION : export_records
 * ─────────────────────────────────────────────────────────
 * WHY      : CSV export of all records matching current filters.
 *            No pagination — all matching rows returned.
 *
 * HOW      : 1. Call record_model.find_all_for_export
 *            2. Map to CSV row format
 *            3. Amount: record.amount.toFixed(2) as string
 *            4. Return array of objects (csv-stringify handles the rest)
 *
 * @param   {string} user_id
 * @param   {object} filters
 * @returns {object[]} - CSV-ready row objects
 * ─────────────────────────────────────────────────────────
 */
async function export_records(user_id, filters) {
    const rows = await record_model.find_all_for_export(user_id, filters);

    return rows.map((record) => ({
        ID: record.id,
        Type: record.type,
        Amount: new Decimal(record.amount).toFixed(2), // string — never float
        Category: record.category?.name ?? '',
        Date: record.date.toISOString().split('T')[0],
        Operator: record.operator,
        Notes: record.notes ?? '',
    }));
}

/*
 * FUNCTION : get_deleted_records
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin audit view — see all soft-deleted records.
 *            Null user_id returns all deleted records across the system.
 *
 * @param   {string|null} user_id_filter
 * @returns {Record[]}
 * ─────────────────────────────────────────────────────────
 */
async function get_deleted_records(user_id_filter) {
    const rows = await record_model.find_deleted(user_id_filter);
    return rows.map(serialize_record);
}

/*
 * FUNCTION : restore_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin restores a soft-deleted record for a user.
 *
 * @param   {string} record_id
 * @returns {Record}
 * ─────────────────────────────────────────────────────────
 */
async function restore_record(record_id) {
    try {
        const record = await record_model.restore(record_id);
        return serialize_record(record);
    } catch (err) {
        if (err.code === 'P2025') throw new Error('Record not found');
        throw err;
    }
}

/*
 * FUNCTION : hard_delete_record
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin permanently removes a record. Irreversible.
 *            Only callable from admin controller.
 *
 * @param   {string} record_id
 * @returns {Record} - deleted record data for confirmation
 * ─────────────────────────────────────────────────────────
 */
async function hard_delete_record(record_id) {
    try {
        const record = await record_model.hard_delete(record_id);
        return serialize_record(record);
    } catch (err) {
        if (err.code === 'P2025') throw new Error('Record not found');
        throw err;
    }
}

module.exports = {
    create_record,
    get_records,
    get_record,
    update_record,
    delete_record,
    bulk_delete_records,
    get_by_date_range,
    export_records,
    get_deleted_records,
    restore_record,
    hard_delete_record,
};