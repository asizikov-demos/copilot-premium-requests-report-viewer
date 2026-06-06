import type {
  UsageArtifacts,
  QuotaArtifacts,
  DailyBucketsArtifacts,
  UserAggregate,
} from '@/utils/ingestion/types';

/**
 * Shared test factories for ingestion artifacts.
 *
 * These produce the full, consistent shape matching the real aggregator output so
 * that a change to the underlying types only needs to be reflected here. Use
 * generic, non-PII names in defaults (e.g. `model-a`).
 */

export interface MakeUsageUser {
  user: string;
  totalRequests: number;
  modelBreakdown?: Record<string, number>;
  organization?: string;
  costCenter?: string;
}

/**
 * Build a {@link UsageArtifacts} object from a list of users.
 *
 * `modelTotals`, `userCount` and `modelCount` are derived from the per-user
 * `modelBreakdown` (defaulting to `{ 'model-a': totalRequests }`) to keep the
 * shape consistent with UsageAggregator output.
 */
export function makeUsageArtifacts(users: MakeUsageUser[]): UsageArtifacts {
  const modelTotals: Record<string, number> = {};
  const userAggregates: UserAggregate[] = users.map((u) => {
    const modelBreakdown = u.modelBreakdown ?? { 'model-a': u.totalRequests };

    let topModel: string | undefined;
    let topModelValue = -Infinity;
    for (const [model, qty] of Object.entries(modelBreakdown)) {
      modelTotals[model] = (modelTotals[model] || 0) + qty;
      if (qty > topModelValue) {
        topModel = model;
        topModelValue = qty;
      }
    }

    const aggregate: UserAggregate = {
      user: u.user,
      totalRequests: u.totalRequests,
      modelBreakdown,
    };
    if (topModel !== undefined) {
      aggregate.topModel = topModel;
      aggregate.topModelValue = topModelValue;
    }
    if (u.organization !== undefined) aggregate.organization = u.organization;
    if (u.costCenter !== undefined) aggregate.costCenter = u.costCenter;
    return aggregate;
  });

  return {
    users: userAggregates,
    modelTotals,
    userCount: users.length,
    modelCount: Object.keys(modelTotals).length,
  };
}

export interface MakeQuotaEntry {
  user: string;
  quota: number | 'unknown';
}

/**
 * Build a {@link QuotaArtifacts} object from a list of user/quota entries.
 *
 * All required fields are populated so callers can spread/override the result
 * without type errors. `distinctQuotas`/`hasMixedQuotas` are derived from the
 * provided numeric quotas.
 */
export function makeQuotaArtifacts(entries: MakeQuotaEntry[]): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unknown'>();
  for (const e of entries) {
    quotaByUser.set(e.user, e.quota);
  }
  const distinctQuotas = new Set<number>(
    entries
      .map((e) => e.quota)
      .filter((q): q is number => typeof q === 'number')
  );
  return {
    quotaByUser,
    conflicts: new Map(),
    distinctQuotas,
    hasMixedQuotas: distinctQuotas.size > 1,
    hasMixedLicenses: false,
  };
}

export interface MakeDailyBucketEntry {
  date: string;
  user: string;
  used: number;
  /** Optional model name; defaults to `model-a`. Used to populate `dailyUserModelTotals`. */
  model?: string;
}

/**
 * Build a {@link DailyBucketsArtifacts} object from flat daily usage entries.
 *
 * Produces both `dailyUserTotals` and `dailyUserModelTotals` matching
 * DailyBucketsAggregator output. Date handling is string-based (UTC-safe) and
 * does not use local timezone conversion.
 */
export function makeDailyBucketsArtifacts(entries: MakeDailyBucketEntry[]): DailyBucketsArtifacts {
  const dailyUserTotals = new Map<string, Map<string, number>>();
  const dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
  let min: string | null = null;
  let max: string | null = null;

  for (const e of entries) {
    const model = e.model ?? 'model-a';

    let userMap = dailyUserTotals.get(e.date);
    if (!userMap) {
      userMap = new Map();
      dailyUserTotals.set(e.date, userMap);
    }
    userMap.set(e.user, (userMap.get(e.user) || 0) + e.used);

    let dayUserMap = dailyUserModelTotals.get(e.date);
    if (!dayUserMap) {
      dayUserMap = new Map();
      dailyUserModelTotals.set(e.date, dayUserMap);
    }
    let modelMap = dayUserMap.get(e.user);
    if (!modelMap) {
      modelMap = new Map();
      dayUserMap.set(e.user, modelMap);
    }
    modelMap.set(model, (modelMap.get(model) || 0) + e.used);

    if (!min || e.date < min) min = e.date;
    if (!max || e.date > max) max = e.date;
  }

  return {
    dailyUserTotals,
    dailyUserModelTotals,
    dateRange: min && max ? { min, max } : null,
    months: Array.from(
      new Set(Array.from(dailyUserTotals.keys()).map((d) => d.slice(0, 7)))
    ).sort(),
  };
}
