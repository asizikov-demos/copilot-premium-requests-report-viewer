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
