/*
 * ============================================================
 * FILE    : api/categories.js
 * LAYER   : Service (HTTP — categories domain)
 * PURPOSE : API calls for the /categories endpoint.
 *           Categories are loaded once per session and shared
 *           between RecordForm (add/edit) and SearchBar (filter).
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - get_categories : GET /categories
 * ============================================================
 */

import api from './client'

/*
 * FUNCTION : get_categories
 * WHY      : Category is a dropdown, not free text. Free text
 *            causes "Food", "food", "FOOD" to appear as three
 *            separate categories in analytics charts — the pie
 *            chart becomes meaningless. This loads the canonical
 *            list: 27 system categories + user's personal ones.
 *
 *            Called once on RecordsPage mount and the result is
 *            passed as a prop to both RecordForm and SearchBar
 *            — no repeated fetches needed.
 *
 *            CATEGORIES NOT SHOWING? Check these in order:
 *              1. Is GET /api/categories a registered route in
 *                 server/src/routes/?
 *              2. Did npx prisma db seed run successfully?
 *                 (the 27 system categories come from the seed)
 *              3. Run in psql: SELECT COUNT(*) FROM "Category";
 *                 Should return 27+. If 0, re-run the seed.
 *              4. Check server console for errors on this request.
 *
 * @returns {Category[]} - [{ id, name, icon, color, user_id }]
 *          user_id is null for system categories
 */
export async function get_categories() {
    const response = await api.get('/categories')
    return response.data.data
}