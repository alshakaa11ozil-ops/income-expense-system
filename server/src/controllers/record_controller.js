/*
 * ============================================================
 * FILE    : record_controller.js  ← SURGICAL FIX — Chat 8
 * LAYER   : Controller
 * PURPOSE : Parse requests and dispatch to record_service
 * DEPENDS : src/services/record_service.js,
 *           src/utils/api_response.js,
 *           csv-stringify/sync
 * ============================================================
 * WHAT CHANGED FROM YOUR ORIGINAL:
 *   ONLY the user_id source changed throughout.
 *
 *   BUG: every function used req.user.user_id
 *   The JWT payload attached by auth_middleware uses req.user.id
 *   (standard JWT sub claim maps to `id`, not `user_id`).
 *   When user_id is undefined, the service receives undefined
 *   and passes it to the model, which is why Prisma shows
 *   `user_id: undefined` in the error.
 *
 *   FIX: req.user.user_id → req.user.id everywhere.
 *
 *   HOW TO VERIFY which field your middleware sets:
 *   Open src/middleware/auth_middleware.js and find the line
 *   where it does req.user = { ... }. Check whether it uses
 *   `id` or `user_id`. If your middleware actually sets
 *   `req.user.user_id`, revert this change. If it sets
 *   `req.user.id`, keep this fix.
 *
 *   Every function body and logic is IDENTICAL to your original.
 * ============================================================
 * EXPORTS: (unchanged)
 *   create, list, get_one, update, delete_one, bulk_delete,
 *   by_date, export_csv, list_deleted, restore, hard_delete,
 *   generate_id
 * ============================================================
 */

const record_service = require('../services/record_service');
const { send_success, send_error, send_paginated } = require('../utils/api_response');
const { stringify } = require('csv-stringify/sync');

/*
 * FUNCTION : create
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — add a new income/expense record.
 * HOW      : Pass user_id + body to service, return 201 on success.
 * @returns {201} created record with category
 * ─────────────────────────────────────────────────────────
 */
async function create(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id (JWT payload field)
        const record = await record_service.create_record(req.user.id, req.body);
        return send_success(res, record, 201);
    } catch (err) {
        const status = err.message === 'Record ID already exists' ? 409 : 400;
        return send_error(res, err.message, status);
    }
}

/*
 * FUNCTION : list
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — list records with search + pagination.
 * HOW      : Pass user_id + query to service, return paginated response.
 * @returns {200} paginated record list
 * ─────────────────────────────────────────────────────────
 */
async function list(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const { data, pagination } = await record_service.get_records(req.user.id, req.query);
        return send_paginated(res, data, pagination);
    } catch (err) {
        return send_error(res, err.message, 400);
    }
}

/*
 * FUNCTION : get_one
 * ─────────────────────────────────────────────────────────
 * WHY      : Fetch a single record for the detail/edit view.
 * HOW      : Pass user_id + id param to service, return 200.
 * @returns {200} single record object
 * ─────────────────────────────────────────────────────────
 */
async function get_one(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const record = await record_service.get_record(req.user.id, req.params.id);
        return send_success(res, record);
    } catch (err) {
        return send_error(res, err.message, 404);
    }
}

/*
 * FUNCTION : update
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — edit a record (id is immutable).
 * HOW      : Pass user_id + id param + body to service, return 200.
 * @returns {200} updated record
 * ─────────────────────────────────────────────────────────
 */
async function update(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const record = await record_service.update_record(req.user.id, req.params.id, req.body);
        return send_success(res, record);
    } catch (err) {
        const status = err.message === 'Record not found' ? 404 : 400;
        return send_error(res, err.message, status);
    }
}

/*
 * FUNCTION : delete_one
 * ─────────────────────────────────────────────────────────
 * WHY      : Teacher requirement — delete from list view (soft delete).
 * HOW      : Pass user_id + id param to service, return 200.
 * @returns {200} soft-deleted record
 * ─────────────────────────────────────────────────────────
 */
async function delete_one(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const record = await record_service.delete_record(req.user.id, req.params.id);
        return send_success(res, record);
    } catch (err) {
        return send_error(res, err.message, 404);
    }
}

/*
 * FUNCTION : bulk_delete
 * ─────────────────────────────────────────────────────────
 * WHY      : User selects multiple rows and deletes them in one action.
 * HOW      : Pass user_id + body.ids array to service, return count.
 * @returns {200} { deleted_count }
 * ─────────────────────────────────────────────────────────
 */
async function bulk_delete(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const result = await record_service.bulk_delete_records(req.user.id, req.body.ids);
        return send_success(res, result);
    } catch (err) {
        return send_error(res, err.message, 400);
    }
}

/*
 * FUNCTION : by_date
 * ─────────────────────────────────────────────────────────
 * WHY      : Date range filter for the records page.
 * HOW      : Pass user_id + query params to service, return paginated.
 * @returns {200} paginated date-filtered records
 * ─────────────────────────────────────────────────────────
 */
async function by_date(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const { data, pagination } = await record_service.get_by_date_range(
            req.user.id,
            req.query
        );
        return send_paginated(res, data, pagination);
    } catch (err) {
        return send_error(res, err.message, 400);
    }
}

/*
 * FUNCTION : export_csv
 * ─────────────────────────────────────────────────────────
 * WHY      : Downloads all matching records as a CSV file.
 *            Different from other handlers — streams a file, not JSON.
 *
 * HOW      : 1. Call service to get CSV-ready rows
 *            2. Set Content-Type and Content-Disposition headers
 *            3. Use csv-stringify to convert rows to CSV string
 *            4. Send raw string
 *
 * @returns {200} CSV file attachment
 * ─────────────────────────────────────────────────────────
 */
async function export_csv(req, res) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const rows = await record_service.export_records(req.user.id, req.query);

        const csv_string = stringify(rows, { header: true });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="records_export.csv"');
        return res.send(csv_string);
    } catch (err) {
        return send_error(res, err.message, 500);
    }
}

/*
 * FUNCTION : list_deleted
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin audit view — see all soft-deleted records.
 * HOW      : Pass optional user_id filter from query to service.
 * @returns {200} deleted records array
 * ─────────────────────────────────────────────────────────
 */
async function list_deleted(req, res) {
    try {
        // No change — admin reads user_id from query param, not req.user
        const records = await record_service.get_deleted_records(req.query.user_id || null);
        return send_success(res, records);
    } catch (err) {
        return send_error(res, err.message, 500);
    }
}

/*
 * FUNCTION : restore
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin restores a soft-deleted record.
 * HOW      : Pass id param to service, return restored record.
 * @returns {200} restored record
 * ─────────────────────────────────────────────────────────
 */
async function restore(req, res) {
    try {
        const record = await record_service.restore_record(req.params.id);
        return send_success(res, record);
    } catch (err) {
        return send_error(res, err.message, 404);
    }
}

/*
 * FUNCTION : hard_delete
 * ─────────────────────────────────────────────────────────
 * WHY      : Admin permanently removes a record. Irreversible.
 * HOW      : Pass id param to service, return deleted record for confirmation.
 * @returns {200} permanently deleted record data
 * ─────────────────────────────────────────────────────────
 */
async function hard_delete(req, res) {
    try {
        const record = await record_service.hard_delete_record(req.params.id);
        return send_success(res, record);
    } catch (err) {
        return send_error(res, err.message, 404);
    }
}

/*
 * FUNCTION : generate_id
 * WHY      : Add Record form pre-fills the ID field with a unique
 *            suggestion. Backend generation guarantees uniqueness —
 *            two open browser tabs cannot generate the same ID.
 * HOW      : Call service → return { suggested_id }
 */
async function generate_id(req, res, next) {
    try {
        // FIX: was req.user.user_id → req.user.id
        const suggested_id = await record_service.generate_record_id(req.user.id);
        send_success(res, { suggested_id });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    create,
    list,
    get_one,
    update,
    delete_one,
    bulk_delete,
    by_date,
    export_csv,
    list_deleted,
    restore,
    hard_delete,
    generate_id,
};