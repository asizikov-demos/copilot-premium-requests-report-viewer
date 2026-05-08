/**
 * UTC date key builder utility.
 *
 * Generates cached primitive representations derived from a Date assumed to be UTC.
 * These values are sliced directly from the ISO string without any locale/timezone conversion.
 *
 * Purpose:
 *  - Avoid repeated calls to `toISOString().split('T')[0]` across analytics paths
 *  - Provide stable grouping keys for days and months
 *  - Supply an epoch number for arithmetic (diffs, sorting) without re-calling getTime()
 */
export interface DateKeys {
  /** Full ISO string (UTC). */
  iso: string;
  /** YYYY-MM-DD (first 10 chars of ISO). */
  dateKey: string;
  /** YYYY-MM (first 7 chars of ISO). */
  monthKey: string;
  /** Milliseconds since Unix epoch (UTC). */
  epoch: number;
}

export interface WeekBucket {
  weekNumber: number;
  startDate: string;
  endDate: string;
}

// Static UTC month names map to avoid locale/date allocations during month label generation.
export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
] as const;

/**
 * Build cached UTC keys for a given Date.
 * The input Date must already represent the correct UTC timestamp provided by the CSV.
 */
export function buildDateKeys(d: Date): DateKeys {
  // Single ISO generation for all derived keys; avoids multiple conversions per record.
  const iso = d.toISOString();
  return {
    iso,
    dateKey: iso.slice(0, 10),
    monthKey: iso.slice(0, 7),
    epoch: d.getTime()
  };
}

export function monthKeyToLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${MONTH_NAMES[monthIndex]} ${yearStr}`;
}

/**
 * Enumerate dates (inclusive) between start and end (UTC).
 * Both start and end should be in YYYY-MM-DD format.
 * Returns an array of date strings in YYYY-MM-DD format.
 */
export function enumerateDatesInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(startDate); d.getTime() <= endDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function dayOfMonthToWeekBucket(day: number, monthKey: string): WeekBucket {
  let weekNumber: number;
  if (day <= 7) weekNumber = 1;
  else if (day <= 14) weekNumber = 2;
  else if (day <= 21) weekNumber = 3;
  else if (day <= 28) weekNumber = 4;
  else weekNumber = 5;

  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const weekStartDay = weekNumber === 1 ? 1 : (weekNumber - 1) * 7 + 1;
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekEndDay = weekNumber < 5 ? weekStartDay + 6 : lastDayOfMonth;

  return {
    weekNumber,
    startDate: `${monthKey}-${String(weekStartDay).padStart(2, '0')}`,
    endDate: `${monthKey}-${String(weekEndDay).padStart(2, '0')}`
  };
}
