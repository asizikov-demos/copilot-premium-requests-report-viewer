/**
 * QuotaAggregator - builds quota mapping during streaming ingestion.
 * Eliminates O(U*R) repeated lookups by maintaining O(1) map.
 */

import { isRequestUnitType } from '@/utils/unitType';

import {
  Aggregator,
  AggregatorContext,
  NormalizedRow,
  QuotaArtifacts,
  SpecialUsageBucketKey
} from './types';

export class QuotaAggregator implements Aggregator<QuotaArtifacts> {
  readonly id = 'quota';
  
  private quotaByUser = new Map<string, number | 'unknown'>();
  private conflicts = new Map<string, Set<number | 'unknown'>>();
  private distinctQuotas = new Set<number>();
  private specialBucketQuotas = new Map<SpecialUsageBucketKey, 0>();
  
  init(_ctx: AggregatorContext): void {
    void _ctx;
    // Reset state
    this.quotaByUser.clear();
    this.conflicts.clear();
    this.distinctQuotas.clear();
    this.specialBucketQuotas.clear();
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    if (row.isNonCopilotUsage && row.usageBucket) {
      this.specialBucketQuotas.set(row.usageBucket, 0);
      return;
    }

    if (row.quotaValue === undefined || !isRequestUnitType(row.unitType)) return;
    
    const existing = this.quotaByUser.get(row.user);
    const current = row.quotaValue;
    
    if (existing === undefined) {
      // First encounter
      this.quotaByUser.set(row.user, current);
      if (typeof current === 'number') {
        this.distinctQuotas.add(current);
      }
    } else if (existing !== current) {
      // Conflict detected
      let set = this.conflicts.get(row.user);
      if (!set) {
        set = new Set([existing]);
        this.conflicts.set(row.user, set);
      }
      set.add(current);
      
      // Resolution policy: numeric quotas win over unknown values; higher numeric quota wins.
      if ((existing === 'unknown' && typeof current === 'number')
        || (typeof current === 'number' && typeof existing === 'number' && current > existing)) {
        this.quotaByUser.set(row.user, current);
        if (typeof current === 'number') {
          this.distinctQuotas.add(current);
        }
      }
    }
  }
  
  finalize(ctx: AggregatorContext): QuotaArtifacts {
    const hasMixedLicenses = this.distinctQuotas.has(ctx.pricing.BUSINESS_QUOTA)
      && this.distinctQuotas.has(ctx.pricing.ENTERPRISE_QUOTA);
    
    const hasUnknown = Array.from(this.quotaByUser.values()).includes('unknown');
    const hasMixedQuotas = this.distinctQuotas.size > 1 
      || (this.distinctQuotas.size >= 1 && hasUnknown);
    
    return {
      quotaByUser: this.quotaByUser,
      conflicts: this.conflicts,
      distinctQuotas: this.distinctQuotas,
      hasMixedQuotas,
      hasMixedLicenses,
      specialBucketQuotas: this.specialBucketQuotas
    };
  }
}
