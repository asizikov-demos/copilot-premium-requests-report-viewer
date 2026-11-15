import {
  accumulateProductCost, createEmptyProductCostMap, getPopulatedProductCosts,
  type ProductCost,
} from '@/utils/productCosts';
import { classifyProductCategory, type ProductCategory } from '@/utils/productClassification';

import {
  getSpecialUsageBucketLabel, UNASSIGNED_BILLING_GROUP,
  type Aggregator, type AggregatorContext, type NormalizedRow,
} from './types';

export interface BillingPageGroup {
  credits: number;
  products: Map<ProductCategory, ProductCost>;
  users: Set<string>;
}

export interface AgentBillingTotals {
  user: string;
  quantity: number;
  gross: number;
  included: number;
  additional: number;
}

export interface BillingPagesArtifacts {
  organizations: Map<string, BillingPageGroup>;
  costCenters: Map<string, BillingPageGroup>;
  codingAgent: Map<string, AgentBillingTotals>;
  codeReview: Map<string, AgentBillingTotals>;
}

function emptyArtifacts(): BillingPagesArtifacts {
  return { organizations: new Map(), costCenters: new Map(), codingAgent: new Map(), codeReview: new Map() };
}

export class BillingPagesAggregator implements Aggregator<BillingPagesArtifacts> {
  readonly id = 'billingPages';
  private artifacts = emptyArtifacts();

  init(): void {
    this.artifacts = emptyArtifacts();
  }

  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    for (const [groups, name] of [
      [this.artifacts.organizations, row.organization || UNASSIGNED_BILLING_GROUP],
      [this.artifacts.costCenters, row.costCenter || UNASSIGNED_BILLING_GROUP],
    ] as const) {
      const group = groups.get(name) ?? {
        credits: 0, products: createEmptyProductCostMap(), users: new Set<string>(),
      };
      group.credits += row.quantity;
      if (!row.isUnattributedUsage) group.users.add(row.user);
      accumulateProductCost(group.products, row);
      groups.set(name, group);
    }

    const category = classifyProductCategory(row.model, row.product, row.sku);
    if (category !== 'Coding Agent' && category !== 'Code Review') return;
    const users = category === 'Coding Agent' ? this.artifacts.codingAgent : this.artifacts.codeReview;
    const user = row.usageBucket ? getSpecialUsageBucketLabel(row.usageBucket) : row.user;
    const totals = users.get(user) ?? {
      user, quantity: 0, gross: 0, included: 0, additional: 0,
    };
    totals.quantity += row.quantity;
    totals.gross += row.grossAmount ?? row.aicGrossAmount ?? 0;
    totals.included += row.discountAmount ?? 0;
    totals.additional += row.netAmount ?? 0;
    users.set(user, totals);
  }

  finalize(): BillingPagesArtifacts {
    return this.artifacts;
  }
}

export function buildBillingGroupRows(groups: Map<string, BillingPageGroup>) {
  return [...groups].map(([name, group]) => ({
    name, credits: group.credits, users: group.users.size,
    products: getPopulatedProductCosts(group.products),
  }));
}

export function buildAgentBillingRows(users: Map<string, AgentBillingTotals>): AgentBillingTotals[] {
  return [...users.values()]
    .filter(row => row.quantity > 0 || row.gross > 0 || row.included > 0 || row.additional > 0)
    .sort((a, b) => b.quantity - a.quantity);
}
