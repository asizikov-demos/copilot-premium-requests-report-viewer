import {
  NON_COPILOT_CODE_REVIEW_LABEL,
  type SpecialUsageBucketAggregate,
  type SpecialUsageBucketKey,
  type UsageArtifacts,
  type UserAggregate,
} from './types';

export interface UsageAccumulationRow {
  user: string;
  model: string;
  quantity: number;
  organization?: string;
  costCenter?: string;
  isNonCopilotUsage?: boolean;
  usageBucket?: SpecialUsageBucketKey;
}

export class UsageAccumulator {
  private userTotals = new Map<string, number>();
  private userModelTotals = new Map<string, Map<string, number>>();
  private modelTotals = new Map<string, number>();
  private topModelPerUser = new Map<string, { model: string; value: number }>();
  private userMetadata = new Map<string, { organization?: string; costCenter?: string }>();
  private organizations = new Set<string>();
  private costCenters = new Set<string>();
  private specialBuckets = new Map<SpecialUsageBucketKey, SpecialUsageBucketAggregate>();

  addRow(row: UsageAccumulationRow): void {
    if (row.isNonCopilotUsage && row.usageBucket) {
      let bucket = this.specialBuckets.get(row.usageBucket);
      if (!bucket) {
        bucket = {
          key: row.usageBucket,
          label: NON_COPILOT_CODE_REVIEW_LABEL,
          totalRequests: 0,
          modelBreakdown: {},
          quotaValue: 0,
        };
        this.specialBuckets.set(row.usageBucket, bucket);
      }
      bucket.totalRequests += row.quantity;
      bucket.modelBreakdown[row.model] = (bucket.modelBreakdown[row.model] || 0) + row.quantity;
      this.modelTotals.set(row.model, (this.modelTotals.get(row.model) || 0) + row.quantity);
      return;
    }

    const { user, model, quantity, organization, costCenter } = row;

    this.userTotals.set(user, (this.userTotals.get(user) || 0) + quantity);

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

    this.modelTotals.set(model, (this.modelTotals.get(model) || 0) + quantity);

    const top = this.topModelPerUser.get(user);
    if (!top || newModelTotal > top.value) {
      this.topModelPerUser.set(user, { model, value: newModelTotal });
    }
  }

  finalize(): UsageArtifacts {
    const users: UserAggregate[] = [];

    for (const [user, totalRequests] of this.userTotals) {
      const modelMap = this.userModelTotals.get(user);
      if (!modelMap) {
        continue;
      }

      const modelBreakdown: Record<string, number> = {};
      for (const [model, value] of modelMap) {
        modelBreakdown[model] = value;
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
        costCenter: metadata?.costCenter,
      });
    }

    return {
      users,
      modelTotals: Object.fromEntries(this.modelTotals),
      userCount: this.userTotals.size,
      modelCount: this.modelTotals.size,
      organizations: Array.from(this.organizations).sort((left, right) => left.localeCompare(right)),
      costCenters: Array.from(this.costCenters).sort((left, right) => left.localeCompare(right)),
      specialBuckets: Array.from(this.specialBuckets.values()),
    };
  }
}
