import { getQuotaTier, shouldReplaceQuotaValue } from '@/utils/analytics/quota';

import { BillingAccumulator } from './billingAccumulator';
import { TokenAccumulator, mergeTokenBreakdown } from './TokenAccumulator';
import { addModelCredits, UsageAccumulator } from './UsageAccumulator';
import type {
  BillingArtifacts, BillingFieldTotals, BillingGroupTotals, BillingUserTotals,
  DailyBucketsArtifacts, FeatureUsageArtifacts, MonthlyArtifacts, QuotaArtifacts,
  SpecialBillingBucketTotals, SpecialUsageBucketAggregate, TokenArtifacts,
  UsageArtifacts, UsageMergeOrder, UserAggregate,
} from './types';

export interface CoreArtifacts {
  usageArtifacts: UsageArtifacts;
  quotaArtifacts: QuotaArtifacts;
  dailyBucketsArtifacts: DailyBucketsArtifacts;
  featureUsageArtifacts: FeatureUsageArtifacts;
  billingArtifacts?: BillingArtifacts;
  tokenArtifacts?: TokenArtifacts | null;
}

export interface MonthlyAggregates {
  usage: MonthlyArtifacts<UsageArtifacts>;
  quota: MonthlyArtifacts<QuotaArtifacts>;
  dailyBuckets: MonthlyArtifacts<DailyBucketsArtifacts>;
  featureUsage: MonthlyArtifacts<FeatureUsageArtifacts>;
  billing?: MonthlyArtifacts<BillingArtifacts>;
  tokens?: MonthlyArtifacts<TokenArtifacts> | null;
}

function sumRecord(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) addModelCredits(target, key, value);
}

export function mergeUsageArtifacts(partials: readonly UsageArtifacts[]): UsageArtifacts {
  const result = new UsageAccumulator().finalize();
  const users = new Map<string, UserAggregate>();
  const orders = new Map<string, UsageMergeOrder>();
  const buckets = new Map<string, SpecialUsageBucketAggregate>();
  const organizations = new Set<string>();
  const costCenters = new Set<string>();
  for (const partial of partials) {
    sumRecord(result.modelTotals, partial.modelTotals);
    for (const value of partial.organizations ?? []) organizations.add(value);
    for (const value of partial.costCenters ?? []) costCenters.add(value);
    for (const source of partial.users) {
      let target = users.get(source.user);
      const sourceOrder = partial.mergeOrder?.get(source.user);
      if (!sourceOrder) throw new Error('Missing source-order metadata in usage month partial');
      let order = orders.get(source.user);
      if (!target) {
        target = { ...source, modelBreakdown: {}, codingAgentCredits: undefined, codingAgentModels: undefined, totalCredits: 0 };
        users.set(source.user, target);
        order = {
          ...sourceOrder,
          modelFirstSeen: new Map(sourceOrder.modelFirstSeen),
          modelLastSeen: new Map(sourceOrder.modelLastSeen),
          codingAgentFirstSeen: new Map(sourceOrder.codingAgentFirstSeen),
        };
        orders.set(source.user, order);
      }
      if (!order) throw new Error('Missing usage merge order');
      order.first = Math.min(order.first, sourceOrder.first);
      if (sourceOrder.organization !== undefined && (order.organization === undefined || sourceOrder.organization < order.organization)) {
        target.organization = source.organization;
        order.organization = sourceOrder.organization;
      }
      if (sourceOrder.costCenter !== undefined && (order.costCenter === undefined || sourceOrder.costCenter < order.costCenter)) {
        target.costCenter = source.costCenter;
        order.costCenter = sourceOrder.costCenter;
      }
      for (const [model, sequence] of sourceOrder.modelLastSeen) {
        order.modelLastSeen.set(model, Math.max(order.modelLastSeen.get(model) ?? -1, sequence));
      }
      for (const [model, sequence] of sourceOrder.modelFirstSeen) {
        order.modelFirstSeen.set(model, Math.min(order.modelFirstSeen.get(model) ?? Infinity, sequence));
      }
      for (const [model, sequence] of sourceOrder.codingAgentFirstSeen) {
        order.codingAgentFirstSeen.set(model, Math.min(order.codingAgentFirstSeen.get(model) ?? Infinity, sequence));
      }
      target.totalCredits += source.totalCredits;
      sumRecord(target.modelBreakdown, source.modelBreakdown);
      if (source.codingAgentCredits !== undefined) target.codingAgentCredits = (target.codingAgentCredits ?? 0) + source.codingAgentCredits;
      if (source.codingAgentModels) target.codingAgentModels = [...new Set([...(target.codingAgentModels ?? []), ...source.codingAgentModels])];
      target.costCenters = [...new Set([...(target.costCenters ?? []), ...(source.costCenters ?? [])])].sort((a, b) => a.localeCompare(b));
    }
    for (const source of partial.specialBuckets ?? []) {
      const target = buckets.get(source.key) ?? { ...source, totalCredits: 0, modelBreakdown: {} };
      target.totalCredits += source.totalCredits;
      sumRecord(target.modelBreakdown, source.modelBreakdown);
      buckets.set(source.key, target);
    }
  }
  for (const [user, target] of users) {
    const order = orders.get(user);
    const reached = (model: string) => order?.modelLastSeen.get(model) ?? order?.modelFirstSeen.get(model) ?? 0;
    const models = Object.entries(target.modelBreakdown).sort(([a, av], [b, bv]) =>
      bv - av || reached(a) - reached(b));
    target.topModel = models[0]?.[0];
    target.topModelValue = models[0]?.[1];
    target.codingAgentModels?.sort((a, b) => (order?.codingAgentFirstSeen.get(a) ?? 0) - (order?.codingAgentFirstSeen.get(b) ?? 0));
  }
  result.users = [...users.values()].sort((a, b) => orders.get(a.user)!.first - orders.get(b.user)!.first);
  result.userCount = users.size;
  result.modelCount = Object.keys(result.modelTotals).length;
  result.organizations = [...organizations].sort((a, b) => a.localeCompare(b));
  result.costCenters = [...costCenters].sort((a, b) => a.localeCompare(b));
  result.specialBuckets = [...buckets.values()];
  result.mergeOrder = orders;
  return result;
}

export function mergeQuotaArtifacts(partials: readonly QuotaArtifacts[]): QuotaArtifacts {
  const quotaByUser: QuotaArtifacts['quotaByUser'] = new Map();
  const conflicts: QuotaArtifacts['conflicts'] = new Map();
  const distinctQuotas = new Set<number>();
  const specialBucketQuotas: NonNullable<QuotaArtifacts['specialBucketQuotas']> = new Map();
  const observations: NonNullable<QuotaArtifacts['observations']> = new Map();
  for (const partial of partials) {
    if (partial.quotaByUser.size && !partial.observations) throw new Error('Missing quota observations in month partial');
    for (const [key, value] of partial.specialBucketQuotas ?? []) specialBucketQuotas.set(key, value);
    for (const [user, values] of partial.observations ?? []) {
      const target = observations.get(user) ?? new Map();
      for (const [value, sequence] of values) target.set(value, Math.min(target.get(value) ?? Infinity, sequence));
      observations.set(user, target);
    }
  }
  const events = [...observations].flatMap(([user, values]) =>
    [...values].map(([value, sequence]) => ({ user, value, sequence }))).sort((a, b) => a.sequence - b.sequence);
  for (const { user, value } of events) {
    const previous = quotaByUser.get(user);
    if (previous !== undefined && previous !== value) {
      const values = conflicts.get(user) ?? new Set([previous]);
      values.add(value);
      conflicts.set(user, values);
    }
    if (shouldReplaceQuotaValue(previous, value)) {
      quotaByUser.set(user, value);
      if (typeof value === 'number') distinctQuotas.add(value);
    }
  }
  const tiers = new Set([...distinctQuotas].map(getQuotaTier).filter(tier => tier !== null));
  const hasUnknown = [...quotaByUser.values()].includes('unknown');
  return {
    quotaByUser, conflicts, distinctQuotas, specialBucketQuotas, observations,
    hasMixedLicenses: tiers.has('business') && tiers.has('enterprise'),
    hasMixedQuotas: tiers.size > 1 || (tiers.size >= 1 && hasUnknown),
  };
}

export function mergeDailyBucketsArtifacts(partials: readonly DailyBucketsArtifacts[]): DailyBucketsArtifacts {
  const result: DailyBucketsArtifacts = {
    dailyUserTotals: new Map(), dailyUserModelTotals: new Map(), dailyCodingAgentTotals: new Map(),
    dailyBucketTotals: new Map(), dailyBucketModelTotals: new Map(), dateRange: null, months: [],
  };
  const months = new Set<string>();
  for (const partial of partials) {
    // Month partitions have disjoint days; sharing the read-only daily maps avoids a deep copy.
    for (const [day, value] of partial.dailyUserTotals) result.dailyUserTotals.set(day, value);
    for (const [day, value] of partial.dailyUserModelTotals ?? []) result.dailyUserModelTotals!.set(day, value);
    for (const [day, value] of partial.dailyCodingAgentTotals ?? []) result.dailyCodingAgentTotals!.set(day, value);
    for (const [day, value] of partial.dailyBucketTotals ?? []) result.dailyBucketTotals!.set(day, value);
    for (const [day, value] of partial.dailyBucketModelTotals ?? []) result.dailyBucketModelTotals!.set(day, value);
    for (const month of partial.months ?? []) months.add(month);
    if (partial.dateRange) {
      const range = result.dateRange;
      result.dateRange = {
        min: range && range.min < partial.dateRange.min ? range.min : partial.dateRange.min,
        max: range && range.max > partial.dateRange.max ? range.max : partial.dateRange.max,
      };
    }
  }
  result.months = [...months].sort();
  return result;
}

export function mergeFeatureUsageArtifacts(partials: readonly FeatureUsageArtifacts[]): FeatureUsageArtifacts {
  const result: FeatureUsageArtifacts = {
    featureTotals: { codeReview: 0, codingAgent: 0, spark: 0, codeQuality: 0 },
    featureUsers: { codeReview: new Set(), codingAgent: new Set(), spark: new Set(), codeQuality: new Set() },
    specialTotals: { unattributedCodeReview: 0, unattributedCodeQuality: 0 },
  };
  for (const partial of partials) {
    for (const feature of Object.keys(result.featureTotals) as (keyof FeatureUsageArtifacts['featureTotals'])[]) {
      result.featureTotals[feature] += partial.featureTotals[feature];
      for (const user of partial.featureUsers[feature]) result.featureUsers[feature].add(user);
    }
    result.specialTotals.unattributedCodeReview += partial.specialTotals.unattributedCodeReview;
    result.specialTotals.unattributedCodeQuality += partial.specialTotals.unattributedCodeQuality;
  }
  return result;
}

const BILLING_FIELDS = ['gross', 'discount', 'net', 'aicQuantity', 'aicGrossAmount'] as const;

function mergeBillingFields(target: Partial<BillingFieldTotals>, source: Partial<BillingFieldTotals>): void {
  for (const field of BILLING_FIELDS) {
    if (source[field] !== undefined) target[field] = (target[field] ?? 0) + source[field];
  }
}

export function mergeBillingArtifacts(partials: readonly BillingArtifacts[]): BillingArtifacts {
  const result = new BillingAccumulator().finalize();
  const userOrder = new Map<string, number>();
  const buckets = new Map<string, SpecialBillingBucketTotals>();
  for (const partial of partials) {
    mergeBillingFields(result.totals, partial.totals);
    result.hasAnyBillingData ||= partial.hasAnyBillingData;
    result.hasAnyAicData ||= partial.hasAnyAicData;
    for (const source of partial.users) {
      userOrder.set(source.user, Math.min(userOrder.get(source.user) ?? Infinity, partial.userOrder?.get(source.user) ?? userOrder.size));
      const target: BillingUserTotals = result.userMap.get(source.user) ?? { user: source.user, quantity: 0 };
      target.quantity += source.quantity;
      mergeBillingFields(target, source);
      if (source.quotaValue !== undefined && shouldReplaceQuotaValue(target.quotaValue, source.quotaValue)) target.quotaValue = source.quotaValue;
      result.userMap.set(source.user, target);
    }
    for (const field of ['orgTotals', 'costCenterTotals', 'billingByModel'] as const) {
      for (const [key, source] of partial[field]) {
        const target: BillingGroupTotals = result[field].get(key) ?? { quantity: 0, gross: 0, discount: 0, net: 0, aicQuantity: 0, aicGrossAmount: 0 };
        target.quantity += source.quantity;
        mergeBillingFields(target, source);
        result[field].set(key, target);
      }
    }
    for (const source of partial.specialBuckets ?? []) {
      const target = buckets.get(source.key) ?? { key: source.key, label: source.label, quantity: 0, quotaValue: 0 };
      target.quantity += source.quantity;
      mergeBillingFields(target, source);
      buckets.set(source.key, target);
    }
  }
  result.users = [...result.userMap.values()].sort((a, b) => userOrder.get(a.user)! - userOrder.get(b.user)!);
  result.userOrder = userOrder;
  result.specialBuckets = [...buckets.values()];
  return result;
}

export function mergeTokenArtifacts(partials: readonly TokenArtifacts[]): TokenArtifacts {
  const result = new TokenAccumulator().finalize();
  for (const partial of partials) {
    mergeTokenBreakdown(result, partial);
    result.hasAnyTokenData ||= partial.hasAnyTokenData;
    for (const [day, value] of partial.byDay) result.byDay.set(day, value);
  }
  result.byDay = new Map([...result.byDay].sort(([a], [b]) => a.localeCompare(b)));
  return result;
}

function select<T>(artifacts: MonthlyArtifacts<T>, months: readonly string[], merge: (partials: T[]) => T): T {
  if (months.length === 0) return artifacts;
  if (!artifacts.byMonth) throw new Error('Missing month partitions in ingestion artifacts');
  const selected = new Set(months);
  return merge([...artifacts.byMonth].filter(([month]) => selected.has(month)).map(([, partial]) => partial));
}

/** Call inside useMemo with aggregates and selectedMonths as dependencies. */
export function selectCoreArtifacts(aggregates: MonthlyAggregates, selectedMonths: readonly string[]): CoreArtifacts {
  return {
    usageArtifacts: select(aggregates.usage, selectedMonths, mergeUsageArtifacts),
    quotaArtifacts: select(aggregates.quota, selectedMonths, mergeQuotaArtifacts),
    dailyBucketsArtifacts: select(aggregates.dailyBuckets, selectedMonths, mergeDailyBucketsArtifacts),
    featureUsageArtifacts: select(aggregates.featureUsage, selectedMonths, mergeFeatureUsageArtifacts),
    billingArtifacts: aggregates.billing && select(aggregates.billing, selectedMonths, mergeBillingArtifacts),
    tokenArtifacts: aggregates.tokens && select(aggregates.tokens, selectedMonths, mergeTokenArtifacts),
  };
}
