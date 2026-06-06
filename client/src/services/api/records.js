/*
 * ============================================================
 * FILE    : api/records.js
 * LAYER   : Service (HTTP — records domain)
 * PURPOSE : All API calls for the /records/* endpoints.
 *           CRUD, bulk delete, CSV export, ID generation.
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - generate_record_id   : GET  /records/generate-id
 *   - create_record        : POST /records
 *   - get_records          : GET  /records (filtered + paginated)
 *   - get_record           : GET  /records/:id
 *   - update_record        : PUT  /records/:id
 *   - delete_record        : DELETE /records/:id (soft)
 *   - bulk_delete_records  : DELETE /records/bulk
 *   - export_records       : GET  /records/export → CSV download
 * ============================================================
 */

import api from './client'

/*
 * FUNCTION : generate_record_id
 * WHY      : Teacher requires user-defined IDs with duplicate check.
 *            Pre-filling reduces friction — user sees a valid unique
 *            ID and can accept or override. Backend uses date +
 *            sequence so two open tabs cannot collide.
 * @returns {string} e.g. "REC-20260605-0003"
 */
export async function generate_record_id() {
    const response = await api.get('/records/generate-id')
    return response.data.data.suggested_id
}

/*
 * FUNCTION : create_record
 * WHY      : Backend runs duplicate ID check + mandatory field
 *            validation. 409 is caught by RecordForm and shown
 *            under the ID field (not a popup).
 * @param   {object} record_data - { id, type, amount, category_id,
 *                                   date, operator, notes }
 * @returns {Record}
 * @throws  {AxiosError} 409 duplicate ID | 400 validation
 */
export async function create_record(record_data) {
    const response = await api.post('/records', record_data)
    return response.data.data
}

/*
 * FUNCTION : get_records
 * WHY      : All filtering is server-side — the DB does the work.
 *            The client never fetches all records and filters in JS.
 *            This is the teacher's "server-side search" requirement
 *            and is the only approach that works at scale.
 * @param   {object} filters - { record_id, type, category_id,
 *                               date_from, date_to, page, limit }
 * @returns {{ data: Record[], pagination: { total, page, limit, total_pages } }}
 */
export async function get_records(filters = {}) {
    const response = await api.get('/records', { params: filters })
    return response.data
}

/*
 * FUNCTION : get_record
 * WHY      : Loads a single record for the edit form. Using the
 *            list endpoint risks stale data if edited elsewhere.
 * @param   {string} record_id
 * @returns {Record}
 */
export async function get_record(record_id) {
    const response = await api.get(`/records/${record_id}`)
    return response.data.data
}

/*
 * FUNCTION : update_record
 * WHY      : The id field must NOT be in the payload — teacher
 *            requires the record ID to be immutable after creation.
 *            Caller strips it; service layer strips it again as
 *            a second line of defence.
 * @param   {string} record_id   - path param
 * @param   {object} record_data - MUST NOT contain id field
 * @returns {Record}
 */
export async function update_record(record_id, record_data) {
    const response = await api.put(`/records/${record_id}`, record_data)
    return response.data.data
}

/*
 * FUNCTION : delete_record
 * WHY      : Soft delete — sets deleted_at on the row. The record
 *            stays in the DB for admin audit. Only ADMINs can
 *            hard-delete via the admin panel (Chat 11).
 * @param   {string} record_id
 * @returns {{ success: true }}
 */
export async function delete_record(record_id) {
    const response = await api.delete(`/records/${record_id}`)
    return response.data
}

/*
 * FUNCTION : bulk_delete_records
 * WHY      : 1 network round trip for N deletes instead of N round
 *            trips. Axios DELETE with a body requires { data: { ids } }
 *            — DELETE requests don't normally carry a body so Axios
 *            puts it in config.data, not the second argument.
 * @param   {string[]} ids
 * @returns {{ success: true }}
 */
export async function bulk_delete_records(ids) {
    const response = await api.delete('/records/bulk', { data: { ids } })
    return response.data
}

/*
 * FUNCTION : export_records
 * WHY      : Passes the same active filters so the CSV contains
 *            exactly what the user sees in the table. responseType
 *            'blob' is critical — without it Axios tries to parse
 *            CSV as JSON and the download fails silently.
 * @param   {object} filters - same keys as get_records
 * @returns {void} - triggers browser file download as side effect
 */
export async function export_records(filters = {}) {
    const response = await api.get('/records/export', {
        params: filters,
        responseType: 'blob',
    })

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'records_export.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}