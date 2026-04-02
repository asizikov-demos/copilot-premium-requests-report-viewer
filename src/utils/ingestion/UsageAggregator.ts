/**
 * UsageAggregator - computes per-user and per-model usage totals.
 * Replaces repeated O(R) scans with incremental O(1) updates.
 */

import {
  Aggregator,
  AggregatorContext,
  NON_COPILOT_CODE_REVIEW_LABEL,
  NormalizedRow,
  SpecialUsageBucketAggregate,
  UsageArtifacts,
  UserAggregate
} from './types';

export class UsageAggregator implements Aggregator<UsageArtifacts> {
  readonly id = 'usage';
  
  private userTotals = new Map<string, number>();
  private userModelTotals = new Map<string, Map<string, number>>();
  private modelTotals = new Map<string, number>();
  private topModelPerUser = new Map<string, { model: string; value: number }>();
  private userMetadata = new Map<string, { organization?: string; costCenter?: string }>();
  private organizations = new Set<string>();
  private costCenters = new Set<string>();
  private specialBuckets = new Map<string, SpecialUsageBucketAggregate>();
  
  init(_ctx: AggregatorContext): void {
    void _ctx;
    // Reset state
    this.userTotals.clear();
    this.userModelTotals.clear();
    this.modelTotals.clear();
    this.topModelPerUser.clear();
    this.userMetadata.clear();
    this.organizations.clear();
    this.costCenters.clear();
    this.specialBuckets.clear();
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    if (row.isNonCopilotUsage && row.usageBucket) {
      let bucket = this.specialBuckets.get(row.usageBucket);
      if (!bucket) {
        bucket = {
          key: row.usageBucket,
          label: NON_COPILOT_CODE_REVIEW_LABEL,
          totalRequests: 0,
          modelBreakdown: {},
          quotaValue: 0
        };
        this.specialBuckets.set(row.usageBucket, bucket);
      }
      bucket.totalRequests += row.quantity;
      bucket.modelBreakdown[row.model] = (bucket.modelBreakdown[row.model] || 0) + row.quantity;
      this.modelTotals.set(row.model, (this.modelTotals.get(row.model) || 0) + row.quantity);
      return;
    }

    const { user, model, quantity, organization, costCenter } = row;
    
    // User totals
    this.userTotals.set(user, (this.userTotals.get(user) || 0) + quantity);
    
    // User-model breakdown
    let modelMap = this.userModelTotals.get(user);
    if (!modelMap) {
      modelMap = new Map();
      this.userModelTotals.set(user, modelMap);
    }
    const newModelTotal = (modelMap.get(model) || 0) + quantity;
    modelMap.set(model, newModelTotal);

    if (organization) {
      this.organizations.add(organization);
    }
    if (costCenter) {
      this.costCenters.add(costCenter);
    }

    const metadata = this.userMetadata.get(user) ?? {};
    if (!metadata.organization && organization) {
      metadata.organization = organization;
    }
    if (!metadata.costCenter && costCenter) {
      metadata.costCenter = costCenter;
    }
    this.userMetadata.set(user, metadata);
    
    // Global model totals
    this.modelTotals.set(model, (this.modelTotals.get(model) || 0) + quantity);
    
    // Track top model per user (avoid sorting later)
    const top = this.topModelPerUser.get(user);
    if (!top || newModelTotal > top.value) {
      this.topModelPerUser.set(user, { model, value: newModelTotal });
    }
  }
  
  finalize(_ctx: AggregatorContext): UsageArtifacts {
    void _ctx;
    const users: UserAggregate[] = [];
    
    for (const [user, totalRequests] of this.userTotals) {
      const modelMap = this.userModelTotals.get(user)!;
      const modelBreakdown: Record<string, number> = {};
      
      for (const [m, val] of modelMap) {
        modelBreakdown[m] = val;
      }
      
      const topEntry = this.topModelPerUser.get(user);
      const metadata = this.userMetadata.get(user);
      
      users.push({
        user,
        totalRequests,
        modelBreakdown,
        topModel: topEntry?.model,
        topModelValue: topEntry?.value,
        organization: metadata?.organization,
        costCenter: metadata?.costCenter
      });
    }
    
    return {
      users,
      modelTotals: Object.fromEntries(this.modelTotals),
      userCount: this.userTotals.size,
      modelCount: this.modelTotals.size,
      organizations: Array.from(this.organizations).sort((a, b) => a.localeCompare(b)),
      costCenters: Array.from(this.costCenters).sort((a, b) => a.localeCompare(b)),
      specialBuckets: Array.from(this.specialBuckets.values())
    };
  }
}
