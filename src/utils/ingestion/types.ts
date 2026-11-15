/**
 * Core types for composable streaming CSV ingestion pipeline.
 */

import { PRICING } from '@/constants/pricing';
import type { TokenCounts } from '@/types/tokens';
import type { UsageUnitKind } from '@/utils/unitType';

export const UNATTRIBUTED_AI_CREDIT_BUCKET = 'unattributed_ai_credit' as const;
export const UNATTRIBUTED_AI_CREDIT_LABEL = 'Unattributed AI Credits' as const;
export const UNASSIGNED_BILLING_GROUP = 'Unassigned' as const;

export type SpecialUsageBucketKey = typeof UNATTRIBUTED_AI_CREDIT_BUCKET;

export function getSpecialUsageBucketLabel(key: SpecialUsageBucketKey): string {
  void key;
  return UNATTRIBUTED_AI_CREDIT_LABEL;
}

export interface SpecialUsageBucketAggregate {
  key: SpecialUsageBucketKey;
  label: string;
  totalCredits: number;
  modelBreakdown: Record<string, number>;
  quotaValue: 0;
}

export interface SpecialBillingBucketTotals {
  key: SpecialUsageBucketKey;
  label: string;
  quantity: number;
  gross?: number;
  discount?: number;
  net?: number;
  aicQuantity?: number;
  aicGrossAmount?: number;
  quotaValue: 0;
}

/**
 * Normalized row after parsing and basic validation.
 * All aggregators receive this uniform shape.
 */
export interface NormalizedRow extends TokenCounts {
  date: string;            // Source date: YYYY-MM-DD or full ISO timestamp
  day: string;             // Precomputed YYYY-MM-DD (UTC preserved)
  user: string;
  model: string;
  quantity: number;        // Parsed numeric value
  quotaRaw?: string;       // Raw quota string from CSV
  quotaValue?: number | 'unknown';
  // Additional fields can be added as needed
  // Extended commercial & billing fields (parsed during normalization)
  product?: string;
  sku?: string;
  unitType?: string;
  usageUnit?: UsageUnitKind;
  billingQuantity?: number;
  organization?: string;
  costCenter?: string; // normalized from cost_center_name
  appliedCostPerQuantity?: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  aicQuantity?: number;
  aicGrossAmount?: number;
  app_client_id?: string;
  image_input?: string;
  image_output?: string;
  isUnattributedUsage?: boolean;
  usageBucket?: SpecialUsageBucketKey;
}

/**
 * Shared context passed to all aggregators.
 * Provides access to constants, configuration, and shared services.
 */
export interface AggregatorContext {
  pricing: typeof PRICING;
  abortSignal?: AbortSignal;
  // Future: logger, feature flags, etc.
}

export interface TokenTotals extends TokenCounts {
  rowCount: number;
  /** Valid counts reported per field, including explicit zeros. */
  reportedRows: Record<keyof TokenCounts, number>;
}

export interface TokenBreakdown {
  totals: TokenTotals;
  byModel: Map<string, TokenTotals>;
  byUser: Map<string, TokenTotals>;
  specialBuckets: Map<SpecialUsageBucketKey, TokenTotals>;
}

export interface TokenArtifacts extends TokenBreakdown {
  hasAnyTokenData: boolean;
  byDay: Map<string, TokenBreakdown>;
}

/**
 * Base interface for all aggregators.
 * Each aggregator computes domain-specific metrics during streaming.
 */
export interface Aggregator<TOutput = unknown> {
  /** Unique identifier for this aggregator */
  readonly id: string;
  
  /** Optional initialization before first row */
  init?(ctx: AggregatorContext): void;
  
  /** Process a single normalized row */
  onRow(row: NormalizedRow, ctx: AggregatorContext): void;
  
  /** Optional hook called after each chunk completes */
  onChunkEnd?(): void;
  
  /** Produce final immutable output after all rows processed */
  finalize(ctx: AggregatorContext): TOutput;
}

/**
 * Configuration options for ingestion pipeline.
 */
export interface IngestOptions {
  chunkSize?: number;
  progressResolution?: number;  // rows between progress callbacks
  onProgress?: (progress: IngestionProgress) => void;
  onComplete: (result: IngestionResult) => void;
  onError?: (error: string) => void;
}

/**
 * Progress information during ingestion.
 */
export interface IngestionProgress {
  rowsProcessed: number;
  usersDiscovered?: number;
  modelsDiscovered?: number;
}

/**
 * Final result after ingestion completes.
 */
export interface IngestionResult {
  outputs: Record<string, unknown>;  // aggregator.id -> finalized output
  rowsProcessed: number;
  durationMs: number;
  warnings: string[];
}

/**
 * Quota-related artifacts (output of QuotaAggregator).
 */
export interface QuotaArtifacts {
  quotaByUser: Map<string, number | 'unknown'>;
  conflicts: Map<string, Set<number | 'unknown'>>;
  distinctQuotas: Set<number>;
  hasMixedQuotas: boolean;
  hasMixedLicenses: boolean;
  specialBucketQuotas?: Map<SpecialUsageBucketKey, 0>;
}

/**
 * Per-user usage aggregate (output of UsageAggregator).
 */
export interface UserAggregate {
  user: string;
  totalCredits: number;
  modelBreakdown: Record<string, number>;
  codingAgentCredits?: number;
  codingAgentModels?: string[];
  topModel?: string;
  topModelValue?: number;
  quotaValue?: number | 'unknown';
  organization?: string;
  costCenter?: string;
  costCenters?: string[];
}

/**
 * Usage aggregation results.
 */
export interface UsageArtifacts {
  users: UserAggregate[];
  modelTotals: Record<string, number>;
  userCount: number;
  modelCount: number;
  organizations?: string[];
  costCenters?: string[];
  specialBuckets?: SpecialUsageBucketAggregate[];
}

/**
 * Daily bucketing results for time-series analysis.
 */
export interface DailyBucketsArtifacts {
  dailyUserTotals: Map<string, Map<string, number>>;
  /** Daily attributed Coding Agent totals, including rows identified by SKU. */
  dailyCodingAgentTotals?: Map<string, number>;
  dateRange: { min: string; max: string } | null;
  /**
   * Optional richer breakdown: day -> user -> model -> quantity.
   * Added to support artifact-based per-user daily model views without retaining raw rows.
   * Present when produced by the updated DailyBucketsAggregator.
   */
  dailyUserModelTotals?: Map<string, Map<string, Map<string, number>>>;
  /**
   * Optional special bucket totals: day -> bucket -> quantity.
   * Used for unattributed AI Credit usage.
   */
  dailyBucketTotals?: Map<string, Map<SpecialUsageBucketKey, number>>;
  /**
   * Optional special bucket per-model totals: day -> bucket -> model -> quantity.
   */
  dailyBucketModelTotals?: Map<string, Map<SpecialUsageBucketKey, Map<string, number>>>;
  /**
   * Sorted list of distinct months (YYYY-MM) encountered while streaming rows.
   * Enables month filter derivation without scanning processedData.
   */
  months?: string[];
}

/**
 * Feature usage aggregation results.
 * Tracks totals and distinct user sets for specialized Copilot features
 * (code review, coding agent, spark, code quality). This enables O(1) access
 * to feature utilization statistics without rescanning raw or per-user
 * model breakdown data at render time.
 */
export interface FeatureUsageArtifacts {
  featureTotals: {
    codeReview: number;
    codingAgent: number;
    spark: number;
    codeQuality: number;
  };
  featureUsers: {
    codeReview: Set<string>;
    codingAgent: Set<string>;
    spark: Set<string>;
    codeQuality: Set<string>;
  };
  specialTotals: {
    unattributedCodeReview: number;
    unattributedCodeQuality: number;
  };
}

/**
 * Billing aggregation results.
 * Sums provided billing columns (gross, discount, net) exactly as supplied in the CSV
 * without recomputation. This enables O(1) access to billing summaries and per-user
 * billing breakdowns without retaining every normalized row (eliminating RawDataAggregator dependency).
 */
export interface BillingUserTotals {
  user: string;
  quantity: number; // total AI Credits
  quotaValue?: number | 'unknown';
  gross?: number;
  discount?: number;
  net?: number;
  aicQuantity?: number;
  aicGrossAmount?: number;
}

export interface BillingFieldTotals {
  gross: number;
  discount: number;
  net: number;
  aicQuantity: number;
  aicGrossAmount: number;
}

export interface BillingGroupTotals extends BillingFieldTotals {
  quantity: number;
}

export interface BillingArtifacts {
  totals: BillingFieldTotals;
  users: BillingUserTotals[]; // unsorted list; consumer may sort
  userMap: Map<string, BillingUserTotals>; // internal convenience map (exposed for advanced consumers)
  orgTotals: Map<string, BillingGroupTotals>;
  costCenterTotals: Map<string, BillingGroupTotals>;
  billingByModel: Map<string, BillingGroupTotals>;
  hasAnyBillingData: boolean; // true if at least one billing numeric column encountered
  hasAnyAicData: boolean; // true if at least one AI Credits numeric column encountered
  specialBuckets?: SpecialBillingBucketTotals[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function approxEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}

function sumNumberValues(value: Record<string, unknown>): number {
  return Object.values(value).reduce((total, entry) => total + (typeof entry === 'number' ? entry : 0), 0);
}

export function isQuotaArtifacts(value: unknown): value is QuotaArtifacts {
  if (!isRecord(value)) return false;

  return (
    value.quotaByUser instanceof Map &&
    value.conflicts instanceof Map &&
    value.distinctQuotas instanceof Set &&
    typeof value.hasMixedQuotas === 'boolean' &&
    typeof value.hasMixedLicenses === 'boolean' &&
    (value.specialBucketQuotas === undefined || value.specialBucketQuotas instanceof Map)
  );
}

export function isUsageArtifacts(value: unknown): value is UsageArtifacts {
  if (!isRecord(value)) return false;

  return (
    Array.isArray(value.users) &&
    isRecord(value.modelTotals) &&
    typeof value.userCount === 'number' &&
    typeof value.modelCount === 'number' &&
    (value.organizations === undefined || Array.isArray(value.organizations)) &&
    (value.costCenters === undefined || Array.isArray(value.costCenters)) &&
    (value.specialBuckets === undefined || Array.isArray(value.specialBuckets))
  );
}

export function isDailyBucketsArtifacts(value: unknown): value is DailyBucketsArtifacts {
  if (!isRecord(value)) return false;

  return (
    value.dailyUserTotals instanceof Map &&
    (value.dailyCodingAgentTotals === undefined || value.dailyCodingAgentTotals instanceof Map) &&
    (value.dateRange === null || isRecord(value.dateRange)) &&
    (value.dailyUserModelTotals === undefined || value.dailyUserModelTotals instanceof Map) &&
    (value.dailyBucketTotals === undefined || value.dailyBucketTotals instanceof Map) &&
    (value.dailyBucketModelTotals === undefined || value.dailyBucketModelTotals instanceof Map) &&
    (value.months === undefined || Array.isArray(value.months))
  );
}

export function isFeatureUsageArtifacts(value: unknown): value is FeatureUsageArtifacts {
  if (!isRecord(value)) return false;

  const { featureTotals, featureUsers, specialTotals } = value;

  return (
    isRecord(featureTotals) &&
    typeof featureTotals.codeReview === 'number' &&
    typeof featureTotals.codingAgent === 'number' &&
    typeof featureTotals.spark === 'number' &&
    typeof featureTotals.codeQuality === 'number' &&
    isRecord(featureUsers) &&
    featureUsers.codeReview instanceof Set &&
    featureUsers.codingAgent instanceof Set &&
    featureUsers.spark instanceof Set &&
    featureUsers.codeQuality instanceof Set &&
    isRecord(specialTotals) &&
    typeof specialTotals.unattributedCodeReview === 'number' &&
    typeof specialTotals.unattributedCodeQuality === 'number'
  );
}

export function isBillingArtifacts(value: unknown): value is BillingArtifacts {
  if (!isRecord(value)) return false;

  return (
    isRecord(value.totals) &&
    Array.isArray(value.users) &&
    value.userMap instanceof Map &&
    value.orgTotals instanceof Map &&
    value.costCenterTotals instanceof Map &&
    value.billingByModel instanceof Map &&
    typeof value.hasAnyBillingData === 'boolean' &&
    typeof value.hasAnyAicData === 'boolean'
  );
}

export function isTokenArtifacts(value: unknown): value is TokenArtifacts {
  if (!isRecord(value)) return false;

  return (
    typeof value.hasAnyTokenData === 'boolean' &&
    isRecord(value.totals) &&
    typeof value.totals.rowCount === 'number' &&
    value.byModel instanceof Map &&
    value.byUser instanceof Map &&
    value.specialBuckets instanceof Map &&
    (value.byDay === undefined || value.byDay instanceof Map)
  );
}

export function getArtifactContractIssues(outputs: Record<string, unknown>): string[] {
  const issues: string[] = [];

  const quota = outputs.quota;
  if (quota === undefined || quota === null) {
    issues.push('quota artifact is missing from ingestion outputs');
  } else if (!isQuotaArtifacts(quota)) {
    issues.push('quota artifact has an invalid shape');
  } else {
    const numericQuotas = Array.from(quota.quotaByUser.values())
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const distinctKnown = Array.from(quota.distinctQuotas)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (numericQuotas.some((value) => !distinctKnown.includes(value))) {
      issues.push('quotaByUser contains quota values not present in distinctQuotas');
    }
    if (distinctKnown.some((value) => !numericQuotas.includes(value))) {
      issues.push('distinctQuotas contains values not present in quotaByUser');
    }
    if (quota.specialBucketQuotas && Array.from(quota.specialBucketQuotas.values()).some(value => value !== 0)) {
      issues.push('quota artifact specialBucketQuotas must be zero-valued');
    }
  }

  const usage = outputs.usage;
  if (usage === undefined || usage === null) {
    issues.push('usage artifact is missing from ingestion outputs');
  } else if (!isUsageArtifacts(usage)) {
    issues.push('usage artifact has an invalid shape');
  } else {
    const userTotal = usage.users.reduce((total, user) => total + (isRecord(user) && typeof user.totalCredits === 'number' ? user.totalCredits : 0), 0);
    const specialTotal = (usage.specialBuckets ?? []).reduce((total, bucket) => total + (isRecord(bucket) && typeof bucket.totalCredits === 'number' ? bucket.totalCredits : 0), 0);
    const modelTotal = sumNumberValues(usage.modelTotals);
    if (!approxEqual(userTotal + specialTotal, modelTotal)) {
      issues.push('usage artifact totals drift between user totals and model totals');
    }

    for (const user of usage.users) {
      if (!isRecord(user)) {
        issues.push('usage artifact contains an invalid user entry');
        continue;
      }
      if (typeof user.user !== 'string') {
        issues.push('usage artifact contains a user entry without a valid user name');
        continue;
      }
      const userModelTotal = Object.values(user.modelBreakdown ?? {}).reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0);
      if (typeof user.totalCredits === 'number' && !approxEqual(userModelTotal, user.totalCredits)) {
        issues.push(`usage artifact for ${user.user} drifts between modelBreakdown and totalCredits`);
      }
    }
  }

  const dailyBuckets = outputs.dailyBuckets;
  if (dailyBuckets === undefined || dailyBuckets === null) {
    issues.push('dailyBuckets artifact is missing from ingestion outputs');
  } else if (!isDailyBucketsArtifacts(dailyBuckets)) {
    issues.push('dailyBuckets artifact has an invalid shape');
  } else {
    const months = dailyBuckets.months ?? [];
    const hasDailyData = dailyBuckets.dailyUserTotals.size > 0
      || dailyBuckets.dailyCodingAgentTotals?.size > 0
      || dailyBuckets.dailyBucketTotals?.size > 0
      || dailyBuckets.dailyBucketModelTotals?.size > 0
      || dailyBuckets.dailyUserModelTotals?.size > 0;
    if (months.length === 0 && hasDailyData) {
      issues.push('dailyBuckets artifact is missing the canonical month list');
    }
    if (months.some((month, index) => index > 0 && month < months[index - 1])) {
      issues.push('dailyBuckets artifact month keys are not sorted in ascending order');
    }
    if (dailyBuckets.dateRange && dailyBuckets.dateRange.min > dailyBuckets.dateRange.max) {
      issues.push('dailyBuckets artifact dateRange min exceeds max');
    }

    if (dailyBuckets.dailyUserModelTotals) {
      for (const [day, users] of dailyBuckets.dailyUserTotals) {
        const perUserModelTotals = dailyBuckets.dailyUserModelTotals.get(day);
        if (!perUserModelTotals) continue;
        for (const [user, total] of users) {
          const modelTotal = Array.from((perUserModelTotals.get(user) ?? new Map()).values()).reduce((sum, value) => sum + value, 0);
          if (!approxEqual(modelTotal, total)) {
            issues.push(`dailyBuckets artifact drifts for ${day}/${user} between dailyUserTotals and dailyUserModelTotals`);
          }
        }
      }
    }

    if (dailyBuckets.dailyBucketTotals && dailyBuckets.dailyBucketModelTotals) {
      for (const [day, bucketTotals] of dailyBuckets.dailyBucketTotals) {
        const perBucketModelTotals = dailyBuckets.dailyBucketModelTotals.get(day);
        if (!perBucketModelTotals) continue;
        for (const [bucket, total] of bucketTotals) {
          const modelTotal = Array.from((perBucketModelTotals.get(bucket) ?? new Map()).values()).reduce((sum, value) => sum + value, 0);
          if (!approxEqual(modelTotal, total)) {
            issues.push(`dailyBuckets artifact drifts for ${day}/${String(bucket)} between dailyBucketTotals and dailyBucketModelTotals`);
          }
        }
      }
    }
  }

  const featureUsage = outputs.featureUsage;
  if (featureUsage === undefined || featureUsage === null) {
    issues.push('featureUsage artifact is missing from ingestion outputs');
  } else if (!isFeatureUsageArtifacts(featureUsage)) {
    issues.push('featureUsage artifact has an invalid shape');
  }

  const billing = outputs.billing;
  if (billing !== undefined && billing !== null && !isBillingArtifacts(billing)) {
    issues.push('billing artifact has an invalid shape');
  }

  const tokens = outputs.tokens;
  if (tokens !== undefined && tokens !== null && !isTokenArtifacts(tokens)) {
    issues.push('tokens artifact has an invalid shape');
  }

  return issues;
}

export function hasValidArtifactContract(outputs: Record<string, unknown>): boolean {
  return getArtifactContractIssues(outputs).length === 0;
}
