/*
 * ============================================================
 * FILE    : api/ai.js
 * LAYER   : Service (HTTP — AI domain)
 * PURPOSE : All API calls for the /ai/* endpoints.
 *           Expense planner, purchase advisor, finance chat.
 *           Built in Chat 10 — file created now so imports
 *           in Chat 10 components can reference a real path.
 * DEPENDS : api/client.js
 * ============================================================
 * EXPORTS:
 *   - ai_plan_expenses    : POST /ai/plan
 *   - ai_advise_purchase  : POST /ai/advise
 *   - ai_analyze_finances : POST /ai/analyze
 * ============================================================
 */

import api from './client'

/*
 * FUNCTION : ai_plan_expenses
 * WHY      : Calls the Gemini-backed planner. Backend injects a
 *            financial summary (not raw records) into the prompt
 *            and returns a structured budget plan.
 *            Daily limit: 10 non-cached calls for USER role.
 *            Cache hits are FREE and do not count toward the limit.
 * @param   {object} payload - { income, goals, period }
 * @returns {object} - budget plan (Zod-validated on backend)
 * @throws  {AxiosError} 429 if daily limit reached
 */
export async function ai_plan_expenses(payload) {
    const response = await api.post('/ai/plan', payload)
    return response.data.data
}

/*
 * FUNCTION : ai_advise_purchase
 * WHY      : "Can I afford X?" advisor. Backend checks current
 *            balance and spending patterns before answering.
 * @param   {object} payload - { item_name, item_cost, notes }
 * @returns {object} - { can_afford, reasoning, recommendation }
 * @throws  {AxiosError} 429 if daily limit reached
 */
export async function ai_advise_purchase(payload) {
    const response = await api.post('/ai/advise', payload)
    return response.data.data
}

/*
 * FUNCTION : ai_analyze_finances
 * WHY      : Free-form financial question. The user can ask
 *            anything about their spending patterns.
 * @param   {object} payload - { question }
 * @returns {object} - { analysis, insights, suggestions }
 * @throws  {AxiosError} 429 if daily limit reached
 */
export async function ai_analyze_finances(payload) {
    const response = await api.post('/ai/analyze', payload)
    return response.data.data
}