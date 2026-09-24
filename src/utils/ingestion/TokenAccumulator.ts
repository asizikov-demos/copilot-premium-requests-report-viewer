import { TOKEN_FIELDS } from './tokenFields';
import type { NormalizedRow, TokenArtifacts, TokenBreakdown, TokenTotals } from './types';

function createTotals(): TokenTotals {
  return {
    rowCount: 0,
    reportedRows: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
}

function createBreakdown(): TokenBreakdown {
  return {
    totals: createTotals(),
    byModel: new Map(),
    byUser: new Map(),
    specialBuckets: new Map(),
  };
}

function mergeTotals(target: TokenTotals, source: TokenTotals): void {
  target.rowCount += source.rowCount;
  for (const field of TOKEN_FIELDS) {
    const count = source[field];
    if (count !== undefined) target[field] = (target[field] ?? 0) + count;
    target.reportedRows[field] += source.reportedRows[field];
  }
}

function addToMap<K>(map: Map<K, TokenTotals>, key: K, totals: TokenTotals): void {
  let target = map.get(key);
  if (!target) {
    target = createTotals();
    map.set(key, target);
  }
  mergeTotals(target, totals);
}

function addRow(breakdown: TokenBreakdown, row: NormalizedRow, totals: TokenTotals): void {
  mergeTotals(breakdown.totals, totals);
  addToMap(breakdown.byModel, row.model, totals);
  if (row.usageBucket) {
    addToMap(breakdown.specialBuckets, row.usageBucket, totals);
  } else if (!row.isUnattributedUsage && row.user !== '') {
    addToMap(breakdown.byUser, row.user, totals);
  }
}

function mergeBreakdown(target: TokenBreakdown, source: TokenBreakdown): void {
  mergeTotals(target.totals, source.totals);
  for (const [model, totals] of source.byModel) addToMap(target.byModel, model, totals);
  for (const [user, totals] of source.byUser) addToMap(target.byUser, user, totals);
  for (const [bucket, totals] of source.specialBuckets) addToMap(target.specialBuckets, bucket, totals);
}

function hasTokenData(totals: TokenTotals): boolean {
  return TOKEN_FIELDS.some(field => totals.reportedRows[field] > 0);
}

export class TokenAccumulator {
  private breakdown = createBreakdown();
  private byDay = new Map<string, TokenBreakdown>();
  private failure?: Error;

  addRow(row: NormalizedRow): void {
    // The first failure is already reported; finalize still rejects partial totals.
    if (this.failure) return;
    const totals = createTotals();
    totals.rowCount = 1;
    for (const field of TOKEN_FIELDS) {
      const count = row[field];
      if (count === undefined) continue;
      if (!Number.isSafeInteger(count) || count < 0) {
        this.failure = new Error(`Invalid normalized token count in ${field} for user=${row.user} date=${row.day}`);
        throw this.failure;
      }
      // Non-negative counts ensure every grouped sum is bounded by the overall sum.
      if (!Number.isSafeInteger((this.breakdown.totals[field] ?? 0) + count)) {
        this.failure = new Error(`Token total exceeds the safe integer range in ${field}`);
        throw this.failure;
      }
      totals[field] = count;
      totals.reportedRows[field] = 1;
    }

    addRow(this.breakdown, row, totals);
    let daily = this.byDay.get(row.day);
    if (!daily) {
      daily = createBreakdown();
      this.byDay.set(row.day, daily);
    }
    addRow(daily, row, totals);
  }

  finalize(): TokenArtifacts {
    if (this.failure) throw this.failure;
    return {
      ...this.breakdown,
      hasAnyTokenData: hasTokenData(this.breakdown.totals),
      byDay: new Map([...this.byDay].sort(([left], [right]) => left.localeCompare(right))),
    };
  }
}

export function filterTokenArtifactsByMonths(
  artifacts: TokenArtifacts,
  selectedMonths: readonly string[]
): TokenArtifacts {
  if (selectedMonths.length === 0) return artifacts;

  const months = new Set(selectedMonths);
  const breakdown = createBreakdown();
  const byDay = new Map<string, TokenBreakdown>();
  for (const [day, daily] of artifacts.byDay) {
    if (!months.has(day.slice(0, 7))) continue;
    mergeBreakdown(breakdown, daily);
    byDay.set(day, daily);
  }
  return { ...breakdown, hasAnyTokenData: hasTokenData(breakdown.totals), byDay };
}
