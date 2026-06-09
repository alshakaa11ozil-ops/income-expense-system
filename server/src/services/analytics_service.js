/*
 * ============================================================
 * FILE    : analytics_service.js
 * LAYER   : Service
 * PURPOSE : Transforms raw Prisma aggregation results into
 *           meaningful financial summaries using decimal.js for
 *           all arithmetic. Serializes all amounts as strings
 *           before returning. Zero HTTP / Prisma contact.
 * DEPENDS : src/models/analytics_model.js, decimal.js
 * ============================================================
 * EXPORTS:
 *   - get_summary            : Dashboard summary cards for a given month
 *   - get_monthly_trends     : Line chart data — income vs expense by month
 *   - get_category_breakdown : Pie chart data — expenses grouped by category
 *   - get_daily_balance      : Running balance for each day in a date range
 *   - get_system_summary     : Admin-only platform-wide totals
 * ============================================================
 */

// ARCHITECTURE GUARD: This file must never import PrismaClient.
// All DB access goes through functions in src/models/analytics_model.js only.

const Decimal = require('decimal.js');
const analytics_model = require('../models/analytics_model');
const category_model = require('../models/category_model');

/*
 * HELPER : to_decimal
 * ─────────────────────────────────────────────────────────
 * WHY      : Prisma Decimal fields come back as Prisma.Decimal objects.
 *            Wrapping them in decimal.js Decimal ensures all arithmetic
 *            is precise — IEEE 754 floating-point cannot be trusted
 *            for financial calculations.
 *
 * HOW      : Converts a Prisma Decimal (or null) to a decimal.js Decimal.
 *            Defaults to 0 when the value is null or undefined (e.g. when
 *            a groupBy bucket has no records for that type).
 *
 * @param   {any} value - Prisma Decimal object, number string, or null
 * @returns {Decimal}   - decimal.js Decimal, never null
 * ─────────────────────────────────────────────────────────
 */
function to_decimal(value) {
    // Prisma returns null for _sum.amount when no records match
    if (value === null || value === undefined) return new Decimal(0);
    return new Decimal(value.toString()); // .toString() handles Prisma Decimal objects
}

/*
 * HELPER : format_month_label
 * ─────────────────────────────────────────────────────────
 * WHY      : Produces a consistent human-readable month label for chart axes.
 *            "2026-01" → "Jan 2026". Centralised so all trend functions
 *            use identical formatting.
 *
 * @param   {Date} date - Any date within the target month
 * @returns {string}    - e.g. "Jan 2026"
 * ─────────────────────────────────────────────────────────
 */
function format_month_label(date) {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/*
 * HELPER : format_month_key
 * ─────────────────────────────────────────────────────────
 * WHY      : Creates a zero-padded "YYYY-MM" key used to bucket records
 *            by month. Consistent key format prevents "2026-1" vs "2026-01"
 *            mismatches when grouping.
 *
 * @param   {Date} date - Any date within the target month
 * @returns {string}    - e.g. "2026-01"
 * ─────────────────────────────────────────────────────────
 */
function format_month_key(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
}

/*
 * HELPER : format_date_key
 * ─────────────────────────────────────────────────────────
 * WHY      : Creates a "YYYY-MM-DD" key for bucketing records by day.
 *            The Record.date field is stored as DATE (no time component),
 *            but JavaScript Date objects always have a time — this helper
 *            strips the time so keys match correctly.
 *
 * @param   {Date} date - A date object
 * @returns {string}    - e.g. "2026-05-15"
 * ─────────────────────────────────────────────────────────
 */
function format_date_key(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
/*
 * FUNCTION : get_summary (UPDATED — dual mode)
 * ─────────────────────────────────────────────────────────
 * WHY      : Two callers need summary totals with different scopes:
 *            Mode A — dashboard cards:  { month, year }
 *            Mode B — records page bar: { date_from, date_to }
 *            One function, same return shape, controller detects mode.
 *
 * HOW      : 1. If params.date_from AND params.date_to → Mode B
 *               Validate date strings, call get_totals_for_range
 *            2. Otherwise → Mode A, call get_totals_by_type
 *            3. Aggregate with Decimal either way
 *
 * @param   {string} user_id
 * @param   {object} params
 *   Mode A: { month: number, year: number }
 *   Mode B: { date_from: string, date_to: string }
 * @returns {{ total_income, total_expense, net_balance, record_count }}
 * ─────────────────────────────────────────────────────────
 */
async function get_summary(user_id, params) {
    let rows;

    if (params.date_from !== undefined && params.date_to !== undefined) {
        // Mode B — arbitrary date range
        const from = new Date(params.date_from);
        const to = new Date(params.date_to);

        if (isNaN(from.getTime())) {
            const err = new Error("Invalid date for 'date_from'");
            err.status = 400; throw err;
        }
        if (isNaN(to.getTime())) {
            const err = new Error("Invalid date for 'date_to'");
            err.status = 400; throw err;
        }
        if (from > to) {
            const err = new Error('date_from must not be after date_to');
            err.status = 400; throw err;
        }

        // Extend to end-of-day so records on date_to are included
        to.setHours(23, 59, 59, 999);

        rows = await analytics_model.get_totals_for_range(user_id, from, to);
    } else {
        // Mode A — calendar month
        const now = new Date();
        const month = Number(params.month) || (now.getMonth() + 1);
        const year = Number(params.year) || now.getFullYear();
        rows = await analytics_model.get_totals_by_type(user_id, month, year, params.category_id);
    }

    // Aggregate — identical for both modes
    let total_income = new Decimal(0);
    let total_expense = new Decimal(0);
    let record_count = 0;

    for (const row of rows) {
        const amount = new Decimal(row._sum.amount ?? 0);
        if (row.type === 'income') total_income = total_income.plus(amount);
        if (row.type === 'expense') total_expense = total_expense.plus(amount);
        record_count += row._count.id ?? 0;
    }

    return {
        total_income: total_income.toFixed(2),
        total_expense: total_expense.toFixed(2),
        net_balance: total_income.minus(total_expense).toFixed(2),
        record_count,
    };
}

/*
 * FUNCTION : get_monthly_trends
 * ─────────────────────────────────────────────────────────
 * WHY      : Builds the line chart data — income vs expense for each of
 *            the last N months. Missing months are filled with zeros so
 *            the chart never renders gaps when a month has no activity.
 *            The AI service calls this with months_back=3 to build context.
 *
 * HOW      : 1. Fetch all records in the lookback window from the model
 *            2. Generate all month labels for the period (ALL months,
 *               even those with no records — prevents chart gaps)
 *            3. Group fetched records into a Map keyed by "YYYY-MM"
 *            4. For each month label: sum income and expense from the bucket
 *               using decimal.js — default to Decimal(0) for empty buckets
 *            5. Serialize all Decimals with .toFixed(2)
 *
 * @param   {string} user_id        - Authenticated user's ID
 * @param   {number} [months_back]  - How many months of history (default 6)
 * @returns {Promise<Array>}        - [{ month, label, income, expense, net }]
 *                                    amounts as strings, all months present
 * @throws  {Error}                 - Propagates model errors
 * ─────────────────────────────────────────────────────────
 */
async function get_monthly_trends(user_id, months_back = 6, category_id = null) {
    const raw_records = await analytics_model.get_records_for_trends(user_id, months_back, category_id);

    // ── Build all month labels for the period ────────────────────────────────
    // Generate labels from oldest to newest so the chart reads left-to-right.
    const now = new Date();
    const month_labels = [];

    for (let i = months_back - 1; i >= 0; i--) {
        // Subtract i months from the current month to get each label date
        const label_date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        month_labels.push({
            key: format_month_key(label_date),
            label: format_month_label(label_date),
        });
    }

    // ── Group raw records into buckets by month key ───────────────────────────
    // Map<"YYYY-MM", { income: Decimal, expense: Decimal }>
    const buckets = new Map();

    for (const record of raw_records) {
        const key = format_month_key(new Date(record.date));

        if (!buckets.has(key)) {
            buckets.set(key, { income: new Decimal(0), expense: new Decimal(0) });
        }

        const bucket = buckets.get(key);
        const amount = to_decimal(record.amount);

        if (record.type === 'income') {
            // Decimal.plus — never use += on financial values
            bucket.income = bucket.income.plus(amount);
        } else {
            bucket.expense = bucket.expense.plus(amount);
        }
    }

    // ── Build final result — every label gets a row, even empty months ────────
    return month_labels.map(({ key, label }) => {
        const bucket = buckets.get(key) ?? { income: new Decimal(0), expense: new Decimal(0) };
        const net = bucket.income.minus(bucket.expense);

        return {
            month: key,
            label,
            income: bucket.income.toFixed(2),
            expense: bucket.expense.toFixed(2),
            net: net.toFixed(2),
        };
    });
}

/*
 * FUNCTION : get_category_breakdown
 * ─────────────────────────────────────────────────────────
 * WHY      : Produces pie chart data — each expense category's share of
 *            total spending for the month with percentage. Also consumed
 *            by budget goal progress bars (actual_spent per category).
 *            Percentages use Decimal division — integer division in JS
 *            would produce 0 for values under 1.
 *
 * HOW      : 1. Call model for expense totals grouped by category
 *            2. Return [] immediately if no expenses (avoids divide-by-zero)
 *            3. Calculate grand_total = sum of all category amounts (Decimal)
 *            4. For each category row:
 *               a. Convert _sum.amount to Decimal
 *               b. Compute percentage = total.dividedBy(grand_total).times(100)
 *               c. Round to 2 decimal places at serialization only
 *            5. Results are already sorted by total desc (done in model)
 *
 * @param   {string} user_id  - Authenticated user's ID
 * @param   {number} month    - Month number 1–12
 * @param   {number} year     - Four-digit year
 * @returns {Promise<Array>}  - [{ category, total, percentage, count }]
 *                              amounts and percentages as strings
 * @throws  {Error}           - Propagates model errors
 * ─────────────────────────────────────────────────────────
 */
async function get_category_breakdown(user_id, month, year) {
    const raw_categories = await analytics_model.get_expense_totals_by_category(
        user_id, month, year
    );

    // Guard: no expense records this month — return empty, not division by zero
    if (raw_categories.length === 0) return [];

    // 2. Fetch category details (name, icon, color) for all ids in the result
    const category_ids = raw_categories.map(row => row.category_id);
    const category_details = await category_model.find_many_by_ids(category_ids);

    // 3. Compute grand total for percentage calculation
    let grand_total = new Decimal(0);
    for (const row of raw_categories) {
        grand_total = grand_total.plus(to_decimal(row._sum?.amount));
    }

    // 4. Enrich raw results with category details and precision percentages
    return raw_categories.map(row => {
        const category_total = to_decimal(row._sum?.amount);
        const details = category_details.find(c => c.id === row.category_id);

        const percentage = grand_total.gt(0)
            ? category_total.div(grand_total).times(100)
            : new Decimal(0);

        return {
            category_id: row.category_id,
            category_name: details?.name ?? 'Unknown',
            icon: details?.icon ?? '❓',
            color: details?.color ?? '#9CA3AF',
            total: category_total.toFixed(2),
            percentage: percentage.toFixed(2),
            // Prisma groupBy returns _count if requested, but we don't need it for the pie chart
            // count: row._count?.id ?? 0, 
        };
    });
}

/*
 * FUNCTION : get_category_activity_map
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides totals for BOTH income and expenses for all categories.
 *            Required by the Categories page to display activity correctly
 *            on both income and expense cards.
 *
 * HOW      : 1. Fetch raw totals grouped by category and type
 *            2. Aggregate into a single object per category
 * ─────────────────────────────────────────────────────────
 */
async function get_category_activity_map(user_id, month, year) {
    const raw_totals = await analytics_model.get_all_category_totals(user_id, month, year);
    
    // Group by category_id
    const map = new Map();
    for (const row of raw_totals) {
        if (!map.has(row.category_id)) {
            map.set(row.category_id, {
                category_id: row.category_id,
                total_income: new Decimal(0),
                total_expense: new Decimal(0)
            });
        }
        
        const bucket = map.get(row.category_id);
        const amount = to_decimal(row._sum?.amount);
        
        if (row.type === 'income') {
            bucket.total_income = bucket.total_income.plus(amount);
        } else {
            bucket.total_expense = bucket.total_expense.plus(amount);
        }
    }
    
    // Serialize
    return Array.from(map.values()).map(b => ({
        category_id: b.category_id,
        total_income: b.total_income.toFixed(2),
        total_expense: b.total_expense.toFixed(2),
        total: (b.total_income.plus(b.total_expense)).toFixed(2) // Some logic might just need "any activity"
    }));
}

/*
 * FUNCTION : get_daily_balance
 * ─────────────────────────────────────────────────────────
 * WHY      : Produces a running balance for each day in a date range,
 *            showing the user exactly when their balance changed and by
 *            how much. More insightful than monthly totals alone.
 *            A running total requires sequential iteration — it cannot
 *            be expressed as a pure SQL aggregate, so it belongs here.
 *
 *            The accumulator is seeded with the user's NET balance from
 *            ALL records before date_from (the "starting balance"). Without
 *            this, viewing May 1–31 would start at $0 even if the user has
 *            $5,000 carried forward from April — a misleading display.
 *
 * HOW      : 1. Validate inputs: date_from <= date_to, range <= 365 days
 *            2. Fetch starting balance (sum of all records before date_from)
 *            3. Fetch ordered records within the date range from model
 *            4. Generate all day labels in the range (every calendar day)
 *            5. Group records into a Map keyed by "YYYY-MM-DD"
 *            6. Initialize running_balance = starting_balance (not 0)
 *            7. Iterate day labels in order:
 *               a. Sum income and expense for that day from the bucket
 *               b. running_balance = running_balance + income - expense
 *               c. Emit { date, income, expense, running_balance }
 *            8. Serialize all Decimals with .toFixed(2)
 *
 * @param   {string} user_id   - Authenticated user's ID
 * @param   {Date}   date_from - Start of date range (inclusive)
 * @param   {Date}   date_to   - End of date range (inclusive)
 * @returns {Promise<Object>}  - { starting_balance, days: [...] }
 *                               starting_balance: net balance before date_from as string
 *                               days: [{ date, income, expense, running_balance }]
 *                               one row per calendar day, amounts as strings
 * @throws  {Error}            - Validation failure or Prisma error
 * ─────────────────────────────────────────────────────────
 */
async function get_daily_balance(user_id, date_from, date_to) {
    // ── Input validation ──────────────────────────────────────────────────────
    if (isNaN(date_from.getTime()) || isNaN(date_to.getTime())) {
        const err = new Error('Invalid date_from or date_to — must be valid ISO date strings');
        err.status_code = 400;
        throw err;
    }

    if (date_from > date_to) {
        const err = new Error('date_from must be on or before date_to');
        err.status_code = 400;
        throw err;
    }

    // Protect against absurdly large ranges that would generate thousands of rows
    const ms_per_day = 1000 * 60 * 60 * 24;
    const day_count = Math.round((date_to - date_from) / ms_per_day) + 1;
    const MAX_DAYS = 365;

    if (day_count > MAX_DAYS) {
        const err = new Error(`Date range too large — maximum ${MAX_DAYS} days allowed`);
        err.status_code = 400;
        throw err;
    }

    // ── Fetch both data sets in parallel — no dependency between them ──────────
    const [prior_totals, raw_records] = await Promise.all([
        // All records BEFORE date_from — gives us the user's real starting point
        analytics_model.get_balance_before_date(user_id, date_from),
        // Records within the requested range — used for day-by-day movement
        analytics_model.get_records_for_daily_balance(user_id, date_from, date_to),
    ]);

    // ── Compute starting balance from historical records ──────────────────────
    // This is the accumulated net balance the user brought in before date_from.
    // Without this, May 1st would incorrectly show $0 instead of e.g. $5,000.
    const prior_income_row = prior_totals.find(row => row.type === 'income');
    const prior_expense_row = prior_totals.find(row => row.type === 'expense');

    const prior_income = to_decimal(prior_income_row?._sum?.amount);
    const prior_expense = to_decimal(prior_expense_row?._sum?.amount);

    // Seed the accumulator with the real historical balance — Decimal subtraction
    const starting_balance = prior_income.minus(prior_expense);

    // ── Group in-range records into daily buckets ─────────────────────────────
    // Map<"YYYY-MM-DD", { income: Decimal, expense: Decimal }>
    const buckets = new Map();

    for (const record of raw_records) {
        const key = format_date_key(new Date(record.date));

        if (!buckets.has(key)) {
            buckets.set(key, { income: new Decimal(0), expense: new Decimal(0) });
        }

        const bucket = buckets.get(key);
        const amount = to_decimal(record.amount);

        if (record.type === 'income') {
            bucket.income = bucket.income.plus(amount);
        } else {
            bucket.expense = bucket.expense.plus(amount);
        }
    }

    // ── Walk every calendar day and accumulate the running balance ─────────────
    const result = [];
    // Start from the user's real historical balance, not zero
    let running_balance = starting_balance;
    const cursor = new Date(date_from);

    while (cursor <= date_to) {
        const day_key = format_date_key(cursor);
        const bucket = buckets.get(day_key) ?? { income: new Decimal(0), expense: new Decimal(0) };

        // Decimal arithmetic — sequential accumulation must never use JS + or -
        running_balance = running_balance
            .plus(bucket.income)
            .minus(bucket.expense);

        result.push({
            date: day_key,
            income: bucket.income.toFixed(2),
            expense: bucket.expense.toFixed(2),
            running_balance: running_balance.toFixed(2),
        });

        // Advance cursor by exactly one day
        cursor.setDate(cursor.getDate() + 1);
    }

    // Return starting_balance alongside days so the frontend can display it
    // as a reference point (e.g. "Balance carried in: $5,000.00")
    return {
        starting_balance: starting_balance.toFixed(2),
        days: result,
    };
}

/*
 * FUNCTION : get_system_summary
 * ─────────────────────────────────────────────────────────
 * WHY      : Provides admin panel system health metrics — total users,
 *            total records, and platform-wide income/expense totals.
 *            This function MUST only be called from admin-protected routes.
 *            The model intentionally omits a user_id filter.
 *
 * HOW      : 1. Call analytics_model.get_system_totals()
 *            2. Extract income and expense from the by_type groupBy result
 *            3. Compute net_balance with Decimal subtraction
 *            4. Serialize all amounts as strings
 *
 * @returns {Promise<Object>} - { total_users, total_records, total_income,
 *                               total_expense, net_balance } amounts as strings
 * @throws  {Error}           - Propagates model errors
 * ─────────────────────────────────────────────────────────
 */
async function get_system_summary() {
    const { user_count, by_type } = await analytics_model.get_system_totals();

    const income_row = by_type.find(row => row.type === 'income');
    const expense_row = by_type.find(row => row.type === 'expense');

    const total_income = to_decimal(income_row?._sum?.amount);
    const total_expense = to_decimal(expense_row?._sum?.amount);
    const net_balance = total_income.minus(total_expense);

    const income_count = income_row?._count?.id ?? 0;
    const expense_count = expense_row?._count?.id ?? 0;
    const total_records = income_count + expense_count;

    return {
        total_users: user_count,
        total_records,
        total_income: total_income.toFixed(2),
        total_expense: total_expense.toFixed(2),
        net_balance: net_balance.toFixed(2),
    };
}

module.exports = {
    get_summary,
    get_monthly_trends,
    get_category_breakdown,
    get_daily_balance,
    get_system_summary,
    get_category_activity_map,
};