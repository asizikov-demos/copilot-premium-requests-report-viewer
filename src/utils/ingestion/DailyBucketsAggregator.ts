/**
 * DailyBucketsAggregator - groups usage by date and user.
 * Provides foundation for cumulative time series without storing full raw data.
 */

import {
  Aggregator,
  AggregatorContext,
  NormalizedRow,
  DailyBucketsArtifacts,
  SpecialUsageBucketKey
} from './types';

export class DailyBucketsAggregator implements Aggregator<DailyBucketsArtifacts> {
  readonly id = 'dailyBuckets';
  
  private dailyUserTotals = new Map<string, Map<string, number>>();
  private dailyUserAicTotals = new Map<string, Map<string, number>>();
  // New: nested map for per-model breakdown (day -> user -> model -> quantity)
  private dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
  private dailyUserAicModelTotals = new Map<string, Map<string, Map<string, number>>>();
  private dailyBucketTotals = new Map<string, Map<SpecialUsageBucketKey, number>>();
  private dailyBucketModelTotals = new Map<string, Map<SpecialUsageBucketKey, Map<string, number>>>();
  private minDate: string | null = null;
  private maxDate: string | null = null;
  private months = new Set<string>();

  private static inc2Level<K1, K2>(
    map: Map<K1, Map<K2, number>>,
    k1: K1,
    k2: K2,
    delta: number
  ): void {
    let innerMap = map.get(k1);
    if (!innerMap) {
      innerMap = new Map<K2, number>();
      map.set(k1, innerMap);
    }
    innerMap.set(k2, (innerMap.get(k2) || 0) + delta);
  }

  private static inc3Level<K1, K2, K3>(
    map: Map<K1, Map<K2, Map<K3, number>>>,
    k1: K1,
    k2: K2,
    k3: K3,
    delta: number
  ): void {
    let middleMap = map.get(k1);
    if (!middleMap) {
      middleMap = new Map<K2, Map<K3, number>>();
      map.set(k1, middleMap);
    }

    let innerMap = middleMap.get(k2);
    if (!innerMap) {
      innerMap = new Map<K3, number>();
      middleMap.set(k2, innerMap);
    }
    innerMap.set(k3, (innerMap.get(k3) || 0) + delta);
  }
  
  init(_ctx: AggregatorContext): void {
    void _ctx;
    // Reset state
    this.dailyUserTotals.clear();
    this.dailyUserAicTotals.clear();
    this.dailyUserModelTotals.clear();
    this.dailyUserAicModelTotals.clear();
    this.dailyBucketTotals.clear();
    this.dailyBucketModelTotals.clear();
    this.minDate = null;
    this.maxDate = null;
    this.months.clear();
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    const { day, user, quantity, model } = row;
    
    // Track date range
    if (!this.minDate || day < this.minDate) {
      this.minDate = day;
    }
    if (!this.maxDate || day > this.maxDate) {
      this.maxDate = day;
    }
    // Track month key (YYYY-MM)
    this.months.add(day.slice(0, 7));

    if (row.isNonCopilotUsage && row.usageBucket) {
      DailyBucketsAggregator.inc2Level(this.dailyBucketTotals, day, row.usageBucket, quantity);
      DailyBucketsAggregator.inc3Level(this.dailyBucketModelTotals, day, row.usageBucket, model, quantity);
      return;
    }

    if (row.usageUnit === 'ai_credit') {
      const aiCredits = row.aicQuantity ?? row.billingQuantity ?? 0;
      if (aiCredits > 0) {
        DailyBucketsAggregator.inc2Level(this.dailyUserAicTotals, day, user, aiCredits);
        DailyBucketsAggregator.inc3Level(this.dailyUserAicModelTotals, day, user, model, aiCredits);
      }
      return;
    }
    
    // Accumulate daily totals
    DailyBucketsAggregator.inc2Level(this.dailyUserTotals, day, user, quantity);

    // Accumulate per-model nested totals
    DailyBucketsAggregator.inc3Level(this.dailyUserModelTotals, day, user, model, quantity);
  }
  
  finalize(_ctx: AggregatorContext): DailyBucketsArtifacts {
    void _ctx;
    return {
      dailyUserTotals: this.dailyUserTotals,
      dailyUserAicTotals: this.dailyUserAicTotals,
      dailyUserModelTotals: this.dailyUserModelTotals,
      dailyUserAicModelTotals: this.dailyUserAicModelTotals,
      dailyBucketTotals: this.dailyBucketTotals,
      dailyBucketModelTotals: this.dailyBucketModelTotals,
      dateRange: this.minDate && this.maxDate 
        ? { min: this.minDate, max: this.maxDate }
        : null,
      months: Array.from(this.months).sort()
    };
  }
}
