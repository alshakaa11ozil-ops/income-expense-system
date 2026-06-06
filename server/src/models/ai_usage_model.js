/*
 * ============================================================
 * FILE    : ai_usage_model.js
 * LAYER   : Model
 * PURPOSE : Prisma queries for the AiUsage table.
 *           Records every AI request for daily limit enforcement
 *           and admin reporting. Separate from AiCache because
 *           "did we already answer this?" is a different concern
 *           from "how many times has this user asked today?"
 * DEPENDS : src/config/database.js (prisma instance)
 * ============================================================
 * EXPORTS:
 *   - log_usage               : Insert a usage row (cached or not)
 *   - count_today_non_cached  : Count billable requests today for a user
 *   - get_usage_for_user      : User-facing usage summary (today's stats)
 *   - get_all_usage_stats     : Admin report — usage across all users
 * ============================================================
 */

const prisma = require('../config/database');

/*
 * FUNCTION : log_usage
 * ─────────────────────────────────────────────────────────
 * WHY      : Record every AI request regardless of whether it was
 *            served from cache. Cached requests are logged with
 *            was_cached: true so admin reports show total usage
 *            including cache hits — needed to calculate cache
 *            hit rate and estimated API cost savings.
 *
 * HOW      : 1. prisma.aiUsage.create with all provided fields
 *            2. tokens_used is null for cache hits (no API call made)
 *
 * @param   {string}      user_id       - User who made the request
 * @param   {AiFeature}   feature_name  - Which AI feature was used
 * @param   {boolean}     was_cached    - true if served from AiCache
 * @param   {number|null} tokens_used   - Gemini token count; null for cache hits
 * @returns {AiUsage}                   - The created usage row
 * ─────────────────────────────────────────────────────────
 */
async function log_usage(user_id, feature_name, was_cached, tokens_used) {
    return prisma.aiUsage.create({
        data: {
            user_id,
            feature_name,
            was_cached,
            tokens_used: tokens_used ?? null,
        },
    });
}

/*
 * FUNCTION : count_today_non_cached
 * ─────────────────────────────────────────────────────────
 * WHY      : Enforce daily AI request limits before calling Gemini.
 *            Counts only non-cached requests because cache hits are
 *            free — they consume no Gemini quota and cost nothing.
 *            The daily limit exists to prevent quota exhaustion,
 *            so only actual API calls count against it.
 *
 * HOW      : 1. Compute start_of_today: today at 00:00:00.000
 *            2. prisma.aiUsage.count filtering:
 *               - user_id matches
 *               - was_cached is false (only real API calls)
 *               - created_at >= start_of_today (resets at midnight)
 *
 * @param   {string}  user_id  - User to count for
 * @returns {number}           - Count of non-cached requests today
 * ─────────────────────────────────────────────────────────
 */
async function count_today_non_cached(user_id) {
    const start_of_today = new Date();
    start_of_today.setHours(0, 0, 0, 0); // midnight local time

    return prisma.aiUsage.count({
        where: {
            user_id,
            was_cached: false,
            created_at: { gte: start_of_today },
        },
    });
}

/*
 * FUNCTION : get_usage_for_user
 * ─────────────────────────────────────────────────────────
 * WHY      : Power the AiAssistantPage header display:
 *            "3 API calls + 2 cached = 5 total today"
 *            Users need to know their remaining limit before
 *            they hit the 429 error mid-workflow.
 *
 * HOW      : 1. Set start_of_today to midnight
 *            2. Count today's non-cached requests for this user
 *            3. Count today's cached requests for this user (separately)
 *            4. Return both counts as separate fields so the UI
 *               can display them distinctly
 *
 * @param   {string}  user_id  - User to query
 * @returns {{ non_cached_today: number, cached_today: number }}
 * ─────────────────────────────────────────────────────────
 */
async function get_usage_for_user(user_id) {
    const start_of_today = new Date();
    start_of_today.setHours(0, 0, 0, 0);

    const [non_cached_today, cached_today] = await Promise.all([
        prisma.aiUsage.count({
            where: {
                user_id,
                was_cached: false,
                created_at: { gte: start_of_today },
            },
        }),
        prisma.aiUsage.count({
            where: {
                user_id,
                was_cached: true,
                created_at: { gte: start_of_today },
            },
        }),
    ]);

    return { non_cached_today, cached_today };
}

/*
 * FUNCTION : get_all_usage_stats
 * ─────────────────────────────────────────────────────────
 * WHY      : Power the admin AI usage report (AdminAiUsage.jsx).
 *            Shows which features are used most, cache hit rates,
 *            estimated token costs, and which users are heaviest
 *            consumers. Essential for monitoring free tier quota.
 *
 * HOW      : 1. Compute cutoff date: now minus days_back days
 *            2. prisma.aiUsage.findMany with user join (username, email)
 *            3. Filter created_at >= cutoff
 *            4. Order by created_at descending (most recent first)
 *
 * @param   {number}    days_back  - How many days of history to return (e.g. 7 or 30)
 * @returns {AiUsage[]}            - Usage rows with nested user { username, email }
 * ─────────────────────────────────────────────────────────
 */
async function get_all_usage_stats(days_back) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days_back);

    return prisma.aiUsage.findMany({
        where: {
            created_at: { gte: cutoff },
        },
        include: {
            user: {
                select: {
                    username: true,
                    email: true,
                },
            },
        },
        orderBy: { created_at: 'desc' },
    });
}

module.exports = {
    log_usage,
    count_today_non_cached,
    get_usage_for_user,
    get_all_usage_stats,
};