/*
 * ============================================================
 * FILE    : format_currency.js
 * LAYER   : Utility
 * PURPOSE : Single source of truth for formatting backend amount
 *           strings as human-readable currency. All pages import
 *           from here — no component re-implements formatting.
 * DEPENDS : None
 * ============================================================
 * EXPORTS:
 *   - format_currency : formats "1500.00" → "$1,500.00"
 * ============================================================
 */

/*
 * FUNCTION : format_currency
 * ─────────────────────────────────────────────────────────
 * WHY      : Amounts arrive from the backend as Decimal strings
 *            ("1500.00"). Each page needs them displayed as
 *            "$1,500.00". Centralising this prevents drift where
 *            one page shows "$1500" and another shows "1,500.00".
 *
 *            parseFloat here is display formatting ONLY.
 *            NEVER use this function's output for arithmetic.
 *            All math must go through decimal.js on the backend.
 *
 *            Negative handling: net balances can be negative when
 *            expenses exceed income. Without special handling,
 *            naive string concatenation produces "$-300.00" which
 *            is typographically wrong. Correct form is "-$300.00".
 *
 * HOW      : 1. parseFloat the string — converts "1500.00" to 1500
 *            2. Guard NaN (null / undefined / malformed input)
 *            3. Take absolute value for formatting, track sign
 *            4. toLocaleString with exactly 2 decimal places
 *            5. Re-attach sign in correct position: -$300.00
 *
 * @param   {string}  str_amount       - e.g. "1500.00" or "-300.00"
 * @param   {string}  currency_symbol  - default "$"
 * @returns {string}  formatted string - e.g. "$1,500.00" / "-$300.00"
 * ─────────────────────────────────────────────────────────
 */
export function format_currency(str_amount, currency_symbol = '$') {
    const num = parseFloat(str_amount ?? '0')

    // guard against malformed input (null, undefined, "abc")
    if (isNaN(num)) return `${currency_symbol}0.00`

    // format absolute value so toLocaleString never sees the minus sign
    // — avoids "$-300.00" (sign trapped between symbol and digits)
    const abs_formatted = Math.abs(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    // re-attach sign BEFORE the currency symbol for correct typography
    return num < 0
        ? `-${currency_symbol}${abs_formatted}`
        : `${currency_symbol}${abs_formatted}`
}