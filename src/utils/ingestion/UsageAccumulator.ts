import {
  getSpecialUsageBucketLabel,
  type SpecialUsageBucketAggregate,
  type SpecialUsageBucketKey,
  type UsageArtifacts,
  type UserAggregate,
} from './types';
import { isCodingAgentModel } from '@/utils/productClassification';

export interface UsageAccumulationRow {
  user: string;
  model: string;
  sku?: string;
  quantity: number;
  billingQuantity?: number;
  usageUnit?: 'ai_credit' | 'unknown';
  organization?: string;
  costCenter?: string;
  isUnattributedUsage?: boolean;
  usageBucket?: SpecialUsageBucketKey;
}

interface UserMetadata {
  organization?: string;
  costCenter?: string;
  costCenters: Set<string>;
}

export function addModelCredits(target: Record<string, number>, model: string, credits: number): void {
  const previous = Object.hasOwn(target, model) ? target[model] : 0;
  Object.defineProperty(target, model, {
    value: previous + credits,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

export class UsageAccumulator {
  private userTotals = new Map<string, number>();
  private userModelTotals = new Map<string, Map<string, number>>();
  private userCodingAgentTotals = new Map<string, number>();
  private userCodingAgentModels = new Map<string, Set<string>>();
  private modelTotals = new Map<string, number>();
  private topModelOrder = new Map<string, Set<string>>();
  private userMetadata = new Map<string, UserMetadata>();
  private organizations = new Set<string>();
  private costCenters = new Set<string>();
  private specialBuckets = new Map<SpecialUsageBucketKey, SpecialUsageBucketAggregate>();
  addRow(row: UsageAccumulationRow): void {
    if (row.isUnattributedUsage && row.usageBucket) {
      let bucket = this.specialBuckets.get(row.usageBucket);
      if (!bucket) {
        bucket = {
          key: row.usageBucket,
          label: getSpecialUsageBucketLabel(row.usageBucket),
          totalCredits: 0,
          modelBreakdown: {},
          quotaValue: 0,
        };
        this.specialBuckets.set(row.usageBucket, bucket);
      }
      const bucketQuantity = row.quantity;
      bucket.totalCredits += bucketQuantity;
      addModelCredits(bucket.modelBreakdown, row.model, bucketQuantity);
      this.modelTotals.set(row.model, (this.modelTotals.get(row.model) || 0) + row.quantity);
      return;
    }

    const { user, model, sku, quantity, organization, costCenter } = row;
    this.userTotals.set(user, (this.userTotals.get(user) || 0) + quantity);

    let modelMap = this.userModelTotals.get(user);
    if (!modelMap) {
      modelMap = new Map();
      this.userModelTotals.set(user, modelMap);
    }
    const newModelTotal = (modelMap.get(model) || 0) + quantity;
    modelMap.set(model, newModelTotal);
    const order = this.topModelOrder.get(user) ?? new Set<string>();
    // Final-total ties use the earliest last nonzero update, including corrections.
    if (quantity !== 0) order.delete(model);
    order.add(model);
    this.topModelOrder.set(user, order);

    if (isCodingAgentModel(model, sku)) {
      this.userCodingAgentTotals.set(
        user,
        (this.userCodingAgentTotals.get(user) ?? 0) + quantity
      );
      let codingAgentModels = this.userCodingAgentModels.get(user);
      if (!codingAgentModels) {
        codingAgentModels = new Set<string>();
        this.userCodingAgentModels.set(user, codingAgentModels);
      }
      codingAgentModels.add(model);
    }

    if (organization) {
      this.organizations.add(organization);
    }
    if (costCenter) {
      this.costCenters.add(costCenter);
    }

    const metadata = this.userMetadata.get(user) ?? { costCenters: new Set<string>() };
    if (!metadata.organization && organization) {
      metadata.organization = organization;
    }
    if (!metadata.costCenter && costCenter) {
      metadata.costCenter = costCenter;
    }
    if (costCenter) {
      metadata.costCenters.add(costCenter);
    }
    this.userMetadata.set(user, metadata);

    this.modelTotals.set(model, (this.modelTotals.get(model) || 0) + quantity);
  }

  finalize(): UsageArtifacts {
    const users: UserAggregate[] = [];

    for (const [user, totalCredits] of this.userTotals) {
      const modelMap = this.userModelTotals.get(user);
      if (!modelMap) {
        continue;
      }

      const modelBreakdown: Record<string, number> = Object.fromEntries(modelMap);

      let topEntry: { model: string; value: number } | undefined;
      for (const model of this.topModelOrder.get(user) ?? []) {
        const value = modelMap.get(model)!;
        if (!topEntry || value > topEntry.value) topEntry = { model, value };
      }
      const metadata = this.userMetadata.get(user);
      const codingAgentModels = this.userCodingAgentModels.get(user);

      users.push({
        user,
        totalCredits,
        modelBreakdown,
        codingAgentCredits: this.userCodingAgentTotals.get(user),
        codingAgentModels: codingAgentModels ? Array.from(codingAgentModels) : undefined,
        topModel: topEntry?.model,
        topModelValue: topEntry?.value,
        organization: metadata?.organization,
        costCenter: metadata?.costCenter,
        costCenters: metadata
          ? Array.from(metadata.costCenters).sort((left, right) => left.localeCompare(right))
          : [],
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
