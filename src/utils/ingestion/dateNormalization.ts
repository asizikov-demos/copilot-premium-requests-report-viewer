/**
 * Date normalization for CSV ingestion.
 *
 * Different versions of the GitHub Copilot usage report encode the `date`
 * column differently:
 *  - Legacy / current export: ISO `YYYY-MM-DD` (optionally with a time suffix).
 *  - Newer AI Usage report:   US `M/D/YY` (e.g. `5/29/26`).
 *
 * Downstream code assumes the first 10 characters of the date are ISO
 * `YYYY-MM-DD`. This module converts any supported input into that shape using
 * pure string math only — it never allocates a `Date`, which both avoids
 * per-row overhead and sidesteps the local-timezone interpretation that
 * `new Date("5/29/26")` would apply (violating the app's UTC-only rule).
 */

export type DateFormat = 'iso' | 'us-slash' | 'unknown';

/** Converts a single date value into ISO `YYYY-MM-DD`, or `null` if unsupported. */
export type DateNormalizer = (value: string) => string | null;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const US_SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

/** Two-digit years in the US format are assumed to be in the 2000s. */
const TWO_DIGIT_YEAR_BASE = 2000;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

function isValidMonthDay(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/**
 * Detect the date format of a sample value (typically the first streamed row).
 * Detection is purely structural; it does not attempt to infer month/day order.
 */
export function detectDateFormat(value: string): DateFormat {
  const trimmed = value.trim();
  if (ISO_DATE.test(trimmed)) return 'iso';
  if (US_SLASH_DATE.test(trimmed)) return 'us-slash';
  return 'unknown';
}

function normalizeIso(value: string): string | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidMonthDay(year, month, day)) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeUsSlash(value: string): string | null {
  const match = US_SLASH_DATE.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = match[3].length === 2 ? TWO_DIGIT_YEAR_BASE + Number(match[3]) : Number(match[3]);
  if (!isValidMonthDay(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Create a normalizer bound to a detected format. Selecting the parser once
 * (e.g. from the first streamed row) avoids re-detecting on every row. The
 * returned normalizer still validates each value and returns `null` for inputs
 * that do not match the expected format, so callers can warn and skip rather
 * than crash on malformed data.
 */
export function createDateNormalizer(format: DateFormat): DateNormalizer {
  switch (format) {
    case 'iso':
      return normalizeIso;
    case 'us-slash':
      return normalizeUsSlash;
    default:
      return () => null;
  }
}

/**
 * Universal normalizer that detects the format of each value individually.
 * Used as the default when no pre-selected normalizer is supplied.
 */
export function normalizeDateToIso(value: string): string | null {
  return createDateNormalizer(detectDateFormat(value))(value);
}
