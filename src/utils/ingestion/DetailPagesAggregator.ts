import { DetailAggregator, selectDetailArtifacts, type CompactDetailArtifacts, type DetailArtifacts } from './DetailAggregator';
import { TOKEN_FIELDS } from './tokenFields';
import type { Aggregator, NormalizedRow, TokenArtifacts, TokenBreakdown, TokenTotals } from './types';
import { UNASSIGNED_BILLING_GROUP } from './types';

interface UserDetailsArtifacts {
  details: CompactDetailArtifacts;
  /** day -> model -> [row count, four token sums, four reported-row counts]. */
  tokens: Map<string, Map<string, Float64Array>>;
}

export interface DetailPagesArtifacts {
  users: Map<string, UserDetailsArtifacts>;
  organizations: Map<string, CompactDetailArtifacts>;
  costCenters: Map<string, CompactDetailArtifacts>;
}

export interface UserDetailResult {
  details: DetailArtifacts;
  tokens: TokenArtifacts;
}

function accumulateScope(map: Map<string, DetailAggregator>, key: string, row: NormalizedRow): void {
  let accumulator = map.get(key);
  if (!accumulator) map.set(key, accumulator = new DetailAggregator());
  accumulator.onRow(row);
}

/** All drill-downs share the upload pass. Only users need token drill-downs. */
export class DetailPagesAggregator implements Aggregator<DetailPagesArtifacts> {
  readonly id = 'detailPages';
  private users = new Map<string, DetailAggregator>();
  private organizations = new Map<string, DetailAggregator>();
  private costCenters = new Map<string, DetailAggregator>();
  private tokens = new Map<string, Map<string, Map<string, Float64Array>>>();
  private failure?: Error;

  onRow(row: NormalizedRow): void {
    if (this.failure) return;
    try {
      if (!row.isUnattributedUsage) {
        accumulateScope(this.users, row.user, row);
        let days = this.tokens.get(row.user);
        if (!days) this.tokens.set(row.user, days = new Map());
        let models = days.get(row.day);
        if (!models) days.set(row.day, models = new Map());
        let tokens = models.get(row.model);
        if (!tokens) models.set(row.model, tokens = new Float64Array(9));
        tokens[0]++;
        for (const [index, field] of TOKEN_FIELDS.entries()) {
          const count = row[field];
          if (count === undefined) continue;
          if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(tokens[index + 1] + count)) {
            throw new Error(`Invalid or overflowing detail token total in ${field}`);
          }
          tokens[index + 1] += count;
          tokens[index + 5]++;
        }
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
      users: new Map([...this.users].map(([user, accumulator]) =>
        [user, { details: accumulator.finalize(), tokens: this.tokens.get(user)! }])),
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

function mergeTokenBucket(target: TokenTotals, bucket: Float64Array): void {
  target.rowCount += bucket[0];
  for (const [index, field] of TOKEN_FIELDS.entries()) {
    if (bucket[index + 5] === 0) continue;
    const total = (target[field] ?? 0) + bucket[index + 1];
    if (!Number.isSafeInteger(total)) throw new Error(`Detail token total exceeds the safe integer range in ${field}`);
    target[field] = total;
    target.reportedRows[field] += bucket[index + 5];
  }
}

export function selectUserDetails(artifacts: DetailPagesArtifacts, user: string): UserDetailResult {
  const compact = artifacts.users.get(user);
  if (!compact) throw new Error(`Missing precomputed details for user ${user}`);
  const totals = emptyTokenTotals();
  const byModel = new Map<string, TokenTotals>();
  const byDay = new Map<string, TokenBreakdown>();
  for (const [date, models] of [...compact.tokens].sort(([a], [b]) => a.localeCompare(b))) {
    const dailyTotals = emptyTokenTotals();
    const dailyModels = new Map<string, TokenTotals>();
    for (const [model, bucket] of models) {
      const modelTotals = byModel.get(model) ?? emptyTokenTotals();
      mergeTokenBucket(modelTotals, bucket);
      byModel.set(model, modelTotals);
      const dailyModel = emptyTokenTotals();
      mergeTokenBucket(dailyModel, bucket);
      dailyModels.set(model, dailyModel);
      mergeTokenBucket(dailyTotals, bucket);
      mergeTokenBucket(totals, bucket);
    }
    byDay.set(date, { totals: dailyTotals, byModel: dailyModels, byUser: new Map([[user, dailyTotals]]), specialBuckets: new Map() });
  }
  return {
    details: selectDetailArtifacts(compact.details),
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
