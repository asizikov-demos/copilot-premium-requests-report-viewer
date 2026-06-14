import { PRICING } from '@/constants/pricing';
import { QuotaAggregator } from '@/utils/ingestion/QuotaAggregator';
import type {
  AggregatorContext,
  DailyBucketsArtifacts,
  QuotaArtifacts,
  UsageArtifacts,
  UserAggregate,
} from '@/utils/ingestion/types';

import { makeNormalizedRow } from './makeNormalizedRow';

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
  const organizations = new Set<string>();
  const costCenters = new Set<string>();
  const userAggregates: UserAggregate[] = users.map((u) => {
    const modelBreakdown = u.modelBreakdown && Object.keys(u.modelBreakdown).length > 0
      ? u.modelBreakdown
      : { 'model-a': u.totalRequests };

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
      organization: u.organization || undefined,
      costCenter: u.costCenter || undefined,
    };
    if (topModel !== undefined) {
      aggregate.topModel = topModel;
      aggregate.topModelValue = topModelValue;
    }
    if (u.organization) organizations.add(u.organization);
    if (u.costCenter) costCenters.add(u.costCenter);
    return aggregate;
  });

  return {
    users: userAggregates,
    modelTotals,
    userCount: users.length,
    modelCount: Object.keys(modelTotals).length,
    organizations: Array.from(organizations).sort((left, right) => left.localeCompare(right)),
    costCenters: Array.from(costCenters).sort((left, right) => left.localeCompare(right)),
    specialBuckets: [],
  };
}

export interface MakeQuotaEntry {
  user: string;
  quota: number | 'unknown';
}

/**
 * Build a {@link QuotaArtifacts} object from a list of user/quota entries.
 *
 * Delegates to {@link QuotaAggregator} so the accumulation policy and tier logic
 * have a single source of truth. Each entry is fed through the aggregator as a
 * synthetic `requests` row so the aggregator's own logic computes the result.
 */
export function makeQuotaArtifacts(entries: MakeQuotaEntry[]): QuotaArtifacts {
  const aggregator = new QuotaAggregator();
  const ctx: AggregatorContext = { pricing: PRICING };
  aggregator.init?.(ctx);
  for (const e of entries) {
    aggregator.onRow(
      makeNormalizedRow({
        user: e.user,
        quotaValue: e.quota,
        unitType: 'requests',
        sku: undefined,
      }),
      ctx
    );
  }
  return aggregator.finalize(ctx);
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
    dailyUserAicTotals: new Map(),
    dailyUserModelTotals,
    dailyUserAicModelTotals: new Map(),
    dailyBucketTotals: new Map(),
    dailyBucketModelTotals: new Map(),
    dateRange: min && max ? { min, max } : null,
    months: Array.from(
      new Set(Array.from(dailyUserTotals.keys()).map((d) => d.slice(0, 7)))
    ).sort(),
  };
}
