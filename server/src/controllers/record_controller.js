/*
 * ============================================================
 * FILE    : record_controller.js
 * LAYER   : Controller
 * PURPOSE : Parse requests and dispatch to record_service
 * DEPENDS : src/services/record_service.js,
 *           src/utils/api_response.js,
 *           csv-stringify/sync
 * ============================================================
 * EXPORTS:
 *   - create        : POST create record
 *   - list          : GET paginated + filtered record list
 *   - get_one       : GET single record
 *   - update        : PUT update record
 *   - delete_one    : DELETE soft delete record
 *   - bulk_delete   : DELETE soft delete multiple records
 *   - by_date       : GET date-range filtered records
 *   - export_csv    : GET stream CSV file download
 *   - list_deleted  : GET admin audit — deleted records
 *   - restore       : POST admin restore record
 *   - hard_delete   : DELETE admin permanent delete
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
        const record = await record_service.create_record(req.user.user_id, req.body);
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
        const { data, pagination } = await record_service.get_records(req.user.user_id, req.query);
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
        const record = await record_service.get_record(req.user.user_id, req.params.id);
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
        const record = await record_service.update_record(req.user.user_id, req.params.id, req.body);
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
        const record = await record_service.delete_record(req.user.user_id, req.params.id);
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
        const result = await record_service.bulk_delete_records(req.user.user_id, req.body.ids);
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
        const { data, pagination } = await record_service.get_by_date_range(
            req.user.user_id,
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
        const rows = await record_service.export_records(req.user.user_id, req.query);

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
};