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
