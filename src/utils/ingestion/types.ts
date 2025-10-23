/**
 * Core types for composable streaming CSV ingestion pipeline.
 */

import { PRICING } from '@/constants/pricing';

/**
 * Normalized row after parsing and basic validation.
 * All aggregators receive this uniform shape.
 */
export interface NormalizedRow {
  date: string;            // Raw UTC timestamp string from CSV
  day: string;             // Precomputed YYYY-MM-DD (UTC preserved)
  user: string;
  model: string;
  quantity: number;        // Parsed numeric value
  quotaRaw?: string;       // Raw quota string from CSV
  quotaValue?: number | 'unlimited';
  exceedsQuota?: boolean;
  // Additional fields can be added as needed
  // Extended commercial & billing fields (parsed during normalization)
  product?: string;
  sku?: string;
  organization?: string;
  costCenter?: string; // normalized from cost_center_name
  appliedCostPerQuantity?: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
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
  quotaByUser: Map<string, number | 'unlimited'>;
  conflicts: Map<string, Set<number | 'unlimited'>>;
  distinctQuotas: Set<number>;
  hasMixedQuotas: boolean;
  hasMixedLicenses: boolean;
}

/**
 * Per-user usage aggregate (output of UsageAggregator).
 */
export interface UserAggregate {
  user: string;
  totalRequests: number;
  modelBreakdown: Record<string, number>;
  topModel?: string;
  topModelValue?: number;
  quotaValue?: number | 'unlimited';
}

/**
 * Usage aggregation results.
 */
export interface UsageArtifacts {
  users: UserAggregate[];
  modelTotals: Record<string, number>;
  userCount: number;
  modelCount: number;
}

/**
 * Daily bucketing results for time-series analysis.
 */
export interface DailyBucketsArtifacts {
  dailyUserTotals: Map<string, Map<string, number>>;
  dateRange: { min: string; max: string } | null;
  /**
   * Optional richer breakdown: day -> user -> model -> quantity.
   * Added to support artifact-based replacement of generateUserDailyModelData
   * used by the UserConsumptionModal without retaining raw rows.
   * Present when produced by the updated DailyBucketsAggregator.
   */
  dailyUserModelTotals?: Map<string, Map<string, Map<string, number>>>;
  /**
   * Sorted list of distinct months (YYYY-MM) encountered while streaming rows.
   * Enables month filter derivation without scanning processedData.
   */
  months?: string[];
}

/**
 * Feature usage aggregation results.
 * Tracks totals and distinct user sets for specialized Copilot features
 * (code review, coding agent / padawan, spark). This enables O(1) access
 * to feature utilization statistics without rescanning raw or per-user
 * model breakdown data at render time.
 */
export interface FeatureUsageArtifacts {
  featureTotals: {
    codeReview: number;
    codingAgent: number;
    spark: number;
  };
  featureUsers: {
    codeReview: Set<string>;
    codingAgent: Set<string>;
    spark: Set<string>;
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
  quantity: number; // total request quantity (duplicate of usageArtifacts but convenient for billing view)
  gross?: number;
  discount?: number;
  net?: number;
}

export interface BillingArtifacts {
  totals: { gross: number; discount: number; net: number };
  users: BillingUserTotals[]; // unsorted list; consumer may sort
  userMap: Map<string, BillingUserTotals>; // internal convenience map (exposed for advanced consumers)
  hasAnyBillingData: boolean; // true if at least one billing numeric column encountered
}
