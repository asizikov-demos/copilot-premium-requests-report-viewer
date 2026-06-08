/**
 * QuotaAggregator - builds quota mapping during streaming ingestion.
 * Eliminates O(U*R) repeated lookups by maintaining O(1) map.
 */

import { getQuotaTier, shouldReplaceQuotaValue } from '@/utils/analytics/quota';
import { isSupportedUsageUnitType } from '@/utils/unitType';

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

    if (row.quotaValue === undefined || !isSupportedUsageUnitType(row.unitType, row.sku)) return;
    
    const existing = this.quotaByUser.get(row.user);
    const current = row.quotaValue;
    
    if (existing !== undefined && existing !== current) {
      // Conflict detected
      let set = this.conflicts.get(row.user);
      if (!set) {
        set = new Set([existing]);
        this.conflicts.set(row.user, set);
      }
      set.add(current);
    }

    if (shouldReplaceQuotaValue(existing, current)) {
      this.quotaByUser.set(row.user, current);
      if (typeof current === 'number') {
        this.distinctQuotas.add(current);
      }
    }
  }
  
  finalize(ctx: AggregatorContext): QuotaArtifacts {
    const distinctTiers = new Set(
      Array.from(this.distinctQuotas)
        .map((quota) => getQuotaTier(quota))
        .filter((tier): tier is 'business' | 'enterprise' => tier !== null)
    );
    const hasMixedLicenses = distinctTiers.has('business') && distinctTiers.has('enterprise');
    
    const hasUnknown = Array.from(this.quotaByUser.values()).includes('unknown');
    const hasMixedQuotas = distinctTiers.size > 1 || (distinctTiers.size >= 1 && hasUnknown);
    
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
