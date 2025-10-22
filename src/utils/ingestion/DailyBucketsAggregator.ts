/**
 * DailyBucketsAggregator - groups usage by date and user.
 * Provides foundation for cumulative time series without storing full raw data.
 */

import {
  Aggregator,
  AggregatorContext,
  NormalizedRow,
  DailyBucketsArtifacts
} from './types';

export class DailyBucketsAggregator implements Aggregator<DailyBucketsArtifacts> {
  readonly id = 'dailyBuckets';
  
  private dailyUserTotals = new Map<string, Map<string, number>>();
  private minDate: string | null = null;
  private maxDate: string | null = null;
  
  init(_ctx: AggregatorContext): void {
    // Reset state
    this.dailyUserTotals.clear();
    this.minDate = null;
    this.maxDate = null;
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    const { day, user, quantity } = row;
    
    // Track date range
    if (!this.minDate || day < this.minDate) {
      this.minDate = day;
    }
    if (!this.maxDate || day > this.maxDate) {
      this.maxDate = day;
    }
    
    // Accumulate daily totals
    let dayMap = this.dailyUserTotals.get(day);
    if (!dayMap) {
      dayMap = new Map();
      this.dailyUserTotals.set(day, dayMap);
    }
    dayMap.set(user, (dayMap.get(user) || 0) + quantity);
  }
  
  finalize(_ctx: AggregatorContext): DailyBucketsArtifacts {
    return {
      dailyUserTotals: this.dailyUserTotals,
      dateRange: this.minDate && this.maxDate 
        ? { min: this.minDate, max: this.maxDate }
        : null
    };
  }
}
