/**
 * QuotaAggregator - builds quota mapping during streaming ingestion.
 * Eliminates O(U*R) repeated lookups by maintaining O(1) map.
 */

import {
  Aggregator,
  AggregatorContext,
  NormalizedRow,
  QuotaArtifacts
} from './types';

export class QuotaAggregator implements Aggregator<QuotaArtifacts> {
  readonly id = 'quota';
  
  private quotaByUser = new Map<string, number | 'unlimited'>();
  private conflicts = new Map<string, Set<number | 'unlimited'>>();
  private distinctQuotas = new Set<number>();
  
  init(_ctx: AggregatorContext): void {
    // Reset state
    this.quotaByUser.clear();
    this.conflicts.clear();
    this.distinctQuotas.clear();
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    if (row.quotaValue === undefined) return;
    
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
      
      // Resolution policy: prefer 'unlimited' > higher numeric > existing
      if (current === 'unlimited' 
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
    
    const hasUnlimited = Array.from(this.quotaByUser.values()).includes('unlimited');
    const hasMixedQuotas = this.distinctQuotas.size > 1 
      || (this.distinctQuotas.size >= 1 && hasUnlimited);
    
    return {
      quotaByUser: this.quotaByUser,
      conflicts: this.conflicts,
      distinctQuotas: this.distinctQuotas,
      hasMixedQuotas,
      hasMixedLicenses
    };
  }
}
