// Static UTC month names map to avoid locale/date allocations during month label generation.
export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
] as const;

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

/**
 * Full UTC calendar days for the report's selected billing months, not today's
 * month. Sorts/deduplicates months without inventing unselected months.
 */
export function buildBillingMonthDates(months: Iterable<string>): string[] {
  return [...new Set(months)].sort().flatMap(month => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new RangeError(`Invalid billing month: ${month}`);
    }
    const start = `${month}-01`;
    const end = new Date(`${start}T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    return enumerateDatesInclusive(start, end.toISOString().slice(0, 10));
  });
}
