import { DetailAggregator, selectDetailArtifacts, type CompactDetailArtifacts, type DetailArtifacts } from './DetailAggregator';
import { TOKEN_FIELDS } from './tokenFields';
import type { Aggregator, NormalizedRow, TokenArtifacts, TokenBreakdown, TokenTotals } from './types';
import { UNASSIGNED_BILLING_GROUP } from './types';

export interface DetailPagesArtifacts {
  users: Map<string, CompactDetailArtifacts>;
  organizations: Map<string, CompactDetailArtifacts>;
  costCenters: Map<string, CompactDetailArtifacts>;
}

export interface UserDetailResult {
  details: DetailArtifacts;
  tokens: TokenArtifacts;
}

function accumulateScope(map: Map<string, DetailAggregator>, key: string, row: NormalizedRow, includeTokens = false): void {
  let accumulator = map.get(key);
  if (!accumulator) map.set(key, accumulator = new DetailAggregator(includeTokens));
  accumulator.onRow(row);
}

/** All drill-downs share the upload pass. Only users need token drill-downs. */
export class DetailPagesAggregator implements Aggregator<DetailPagesArtifacts> {
  readonly id = 'detailPages';
  private users = new Map<string, DetailAggregator>();
  private organizations = new Map<string, DetailAggregator>();
  private costCenters = new Map<string, DetailAggregator>();
  private failure?: Error;

  onRow(row: NormalizedRow): void {
    if (this.failure) return;
    try {
      if (!row.isUnattributedUsage) {
        accumulateScope(this.users, row.user, row, true);
      }
      accumulateScope(this.organizations, row.organization || UNASSIGNED_BILLING_GROUP, row);
      accumulateScope(this.costCenters, row.costCenter || UNASSIGNED_BILLING_GROUP, row);
    } catch (error) {
      this.failure = error instanceof Error ? error : new Error(String(error));
      throw this.failure;
    }
  }

  finalize(): DetailPagesArtifacts {
    if (this.failure) throw this.failure;
    return {
      users: new Map([...this.users].map(([user, accumulator]) => [user, accumulator.finalize()])),
      organizations: new Map([...this.organizations].map(([name, accumulator]) => [name, accumulator.finalize()])),
      costCenters: new Map([...this.costCenters].map(([name, accumulator]) => [name, accumulator.finalize()])),
    };
  }
}

function emptyTokenTotals(): TokenTotals {
  return {
    rowCount: 0,
    reportedRows: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
}

function mergeTokenBucket(target: TokenTotals, values: number[], offset: number): void {
  target.rowCount += values[offset];
  for (const [index, field] of TOKEN_FIELDS.entries()) {
    if (values[offset + index + 5] === 0) continue;
    const total = (target[field] ?? 0) + values[offset + index + 1];
    if (!Number.isSafeInteger(total)) throw new Error(`Detail token total exceeds the safe integer range in ${field}`);
    target[field] = total;
    target.reportedRows[field] += values[offset + index + 5];
  }
}

export function selectUserDetails(artifacts: DetailPagesArtifacts, user: string): UserDetailResult {
  const compact = artifacts.users.get(user);
  if (!compact) throw new Error(`Missing precomputed details for user ${user}`);
  const totals = emptyTokenTotals();
  const byModel = new Map<string, TokenTotals>();
  const byDay = new Map<string, TokenBreakdown>();
  for (const [date, models] of [...compact.dailyModels].sort(([a], [b]) => a.localeCompare(b))) {
    const dailyTotals = emptyTokenTotals();
    const dailyModels = new Map<string, TokenTotals>();
    for (const [model, { tokenOffset }] of models) {
      if (tokenOffset === undefined) throw new Error(`Missing precomputed token counts for user ${user}`);
      const modelTotals = byModel.get(model) ?? emptyTokenTotals();
      mergeTokenBucket(modelTotals, compact.values, tokenOffset);
      byModel.set(model, modelTotals);
      const dailyModel = emptyTokenTotals();
      mergeTokenBucket(dailyModel, compact.values, tokenOffset);
      dailyModels.set(model, dailyModel);
      mergeTokenBucket(dailyTotals, compact.values, tokenOffset);
      mergeTokenBucket(totals, compact.values, tokenOffset);
    }
    byDay.set(date, { totals: dailyTotals, byModel: dailyModels, byUser: new Map([[user, dailyTotals]]), specialBuckets: new Map() });
  }
  return {
    details: selectDetailArtifacts(compact),
    tokens: {
      totals, byModel, byDay, byUser: new Map([[user, totals]]), specialBuckets: new Map(),
      hasAnyTokenData: TOKEN_FIELDS.some(field => totals.reportedRows[field] > 0),
    },
  };
}

export function selectBillingGroupDetails(
  artifacts: DetailPagesArtifacts, kind: 'organization' | 'costCenter', name: string,
): { details: DetailArtifacts } {
  const compact = (kind === 'organization' ? artifacts.organizations : artifacts.costCenters).get(name);
  if (!compact) throw new Error(`Missing precomputed details for ${kind} ${name}`);
  return { details: selectDetailArtifacts(compact) };
}
