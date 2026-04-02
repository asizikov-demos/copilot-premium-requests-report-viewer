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
  // New: nested map for per-model breakdown (day -> user -> model -> quantity)
  private dailyUserModelTotals = new Map<string, Map<string, Map<string, number>>>();
  private dailyBucketTotals = new Map<string, Map<SpecialUsageBucketKey, number>>();
  private dailyBucketModelTotals = new Map<string, Map<SpecialUsageBucketKey, Map<string, number>>>();
  private minDate: string | null = null;
  private maxDate: string | null = null;
  private months = new Set<string>();
  
  init(_ctx: AggregatorContext): void {
    void _ctx;
    // Reset state
    this.dailyUserTotals.clear();
    this.dailyUserModelTotals.clear();
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
      let dayBucketTotals = this.dailyBucketTotals.get(day);
      if (!dayBucketTotals) {
        dayBucketTotals = new Map();
        this.dailyBucketTotals.set(day, dayBucketTotals);
      }
      dayBucketTotals.set(row.usageBucket, (dayBucketTotals.get(row.usageBucket) || 0) + quantity);

      let dayBucketModelMap = this.dailyBucketModelTotals.get(day);
      if (!dayBucketModelMap) {
        dayBucketModelMap = new Map();
        this.dailyBucketModelTotals.set(day, dayBucketModelMap);
      }
      let modelMap = dayBucketModelMap.get(row.usageBucket);
      if (!modelMap) {
        modelMap = new Map();
        dayBucketModelMap.set(row.usageBucket, modelMap);
      }
      modelMap.set(model, (modelMap.get(model) || 0) + quantity);
      return;
    }
    
    // Accumulate daily totals
    let dayMap = this.dailyUserTotals.get(day);
    if (!dayMap) {
      dayMap = new Map();
      this.dailyUserTotals.set(day, dayMap);
    }
    dayMap.set(user, (dayMap.get(user) || 0) + quantity);

    // Accumulate per-model nested totals
    let dayUserMap = this.dailyUserModelTotals.get(day);
    if (!dayUserMap) {
      dayUserMap = new Map();
      this.dailyUserModelTotals.set(day, dayUserMap);
    }
    let userModelMap = dayUserMap.get(user);
    if (!userModelMap) {
      userModelMap = new Map();
      dayUserMap.set(user, userModelMap);
    }
    userModelMap.set(model, (userModelMap.get(model) || 0) + quantity);
  }
  
  finalize(_ctx: AggregatorContext): DailyBucketsArtifacts {
    void _ctx;
    return {
      dailyUserTotals: this.dailyUserTotals,
      dailyUserModelTotals: this.dailyUserModelTotals,
      dailyBucketTotals: this.dailyBucketTotals,
      dailyBucketModelTotals: this.dailyBucketModelTotals,
      dateRange: this.minDate && this.maxDate 
        ? { min: this.minDate, max: this.maxDate }
        : null,
      months: Array.from(this.months).sort()
    };
  }
}
