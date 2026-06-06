/*
 * ============================================================
 * FILE    : ai_cache_model.js
 * LAYER   : Model
 * PURPOSE : Prisma queries for the AiCache table.
 *           Stores Gemini API responses to avoid duplicate calls
 *           and reduce quota consumption on the free tier.
 * DEPENDS : src/config/database.js (prisma instance)
 * ============================================================
 * EXPORTS:
 *   - find_by_key       : Lookup a valid (non-expired) cache entry
 *   - create_entry      : Persist a new Gemini response to cache
 *   - increment_hit     : Track reuse count of a cache entry
 *   - delete_expired    : Prune rows past their TTL (cleanup job)
 * ============================================================
 */

const prisma = require('../config/database');

/*
 * FUNCTION : find_by_key
 * ─────────────────────────────────────────────────────────
 * WHY      : First step of every AI request — check if we already
 *            have a valid cached response before calling Gemini.
 *            An expired entry (expires_at < now) must NOT be served
 *            because the user's financial data will have changed.
 *
 * HOW      : 1. Query AiCache for matching cache_key
 *            2. Add expires_at > now guard so stale entries are ignored
 *            3. Return the first match or null if none found
 *
 * @param   {string}        cache_key  - SHA-256 hash of request inputs
 * @returns {AiCache|null}             - Cache row or null on miss
 * ─────────────────────────────────────────────────────────
 */
async function find_by_key(cache_key) {
    return prisma.aiCache.findFirst({
        where: {
            cache_key,
            expires_at: { gt: new Date() }, // only return non-expired entries
        },
    });
}

/*
 * FUNCTION : create_entry
 * ─────────────────────────────────────────────────────────
 * WHY      : After calling Gemini successfully, persist the response
 *            so future identical requests can be served without an
 *            API call. This is the write side of the cache layer.
 *
 * HOW      : 1. Call prisma.aiCache.create with all required fields
 *            2. hit_count starts at 0 — incremented on each cache hit
 *
 * @param   {string}    cache_key      - SHA-256 hash of request inputs
 * @param   {AiFeature} feature_name   - Prisma enum: plan_expenses | advise_purchase | analyze_finances
 * @param   {string}    response_json  - Gemini response serialised as JSON string
 * @param   {string}    user_id        - Owner of this cache entry
 * @param   {Date}      expires_at     - When this entry becomes invalid
 * @returns {AiCache}                  - The newly created cache row
 * ─────────────────────────────────────────────────────────
 */
async function create_entry(cache_key, feature_name, response_json, user_id, expires_at) {
    return prisma.aiCache.create({
        data: {
            cache_key,
            feature_name,
            response_json,
            user_id,
            expires_at,
            hit_count: 0,
        },
    });
}

/*
 * FUNCTION : increment_hit
 * ─────────────────────────────────────────────────────────
 * WHY      : Track how many times each cache entry is reused.
 *            Used in the admin AI usage report to demonstrate
 *            cache value (e.g. "this entry saved 12 API calls").
 *
 * HOW      : 1. prisma.aiCache.update where id matches
 *            2. Increment hit_count by 1 using Prisma's atomic increment
 *
 * @param   {string}  cache_id  - Primary key of the AiCache row to update
 * @returns {AiCache}           - Updated cache row with new hit_count
 * ─────────────────────────────────────────────────────────
 */
async function increment_hit(cache_id) {
    return prisma.aiCache.update({
        where: { id: cache_id },
        data: {
            hit_count: { increment: 1 },
        },
    });
}

/*
 * FUNCTION : delete_expired
 * ─────────────────────────────────────────────────────────
 * WHY      : Prevents the AiCache table from growing unbounded.
 *            Called by the cleanup setInterval in app.js every 6 hours.
 *            Expired entries are dead weight — they can never be served
 *            because find_by_key filters them out with expires_at > now.
 *
 * HOW      : 1. prisma.aiCache.deleteMany where expires_at < now
 *            2. Return count of deleted rows for logging
 *
 * @returns {number}  - Count of rows deleted
 * ─────────────────────────────────────────────────────────
 */
async function delete_expired() {
    const result = await prisma.aiCache.deleteMany({
        where: {
            expires_at: { lt: new Date() },
        },
    });
    return result.count;
}

module.exports = {
    find_by_key,
    create_entry,
    increment_hit,
    delete_expired,
};