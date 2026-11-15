import {
  accumulateProductCost, createEmptyProductCostMap, getPopulatedProductCosts,
  type ProductCost,
} from '@/utils/productCosts';
import { classifyProductCategory, type ProductCategory } from '@/utils/productClassification';

import { MonthlyAggregator } from './MonthlyAggregator';
import {
  getSpecialUsageBucketLabel, UNASSIGNED_BILLING_GROUP,
  type Aggregator, type AggregatorContext, type MonthlyArtifacts, type NormalizedRow,
} from './types';

export interface BillingPageGroup {
  credits: number;
  products: Map<ProductCategory, ProductCost>;
  users: Set<string>;
  first: number;
}

export interface AgentBillingTotals {
  user: string;
  quantity: number;
  gross: number;
  included: number;
  additional: number;
  first: number;
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

class BillingPagesPartialAggregator implements Aggregator<BillingPagesArtifacts> {
  readonly id = 'billingPages';
  private artifacts = emptyArtifacts();
  private sequence = 0;

  onRow(row: NormalizedRow, _ctx: AggregatorContext, sequence = this.sequence++): void {
    const productRow = { ...row, creditsUsed: row.quantity };
    for (const [groups, name] of [
      [this.artifacts.organizations, row.organization || UNASSIGNED_BILLING_GROUP],
      [this.artifacts.costCenters, row.costCenter || UNASSIGNED_BILLING_GROUP],
    ] as const) {
      const group = groups.get(name) ?? {
        credits: 0, products: createEmptyProductCostMap(), users: new Set<string>(), first: sequence,
      };
      group.credits += row.quantity;
      if (!row.isUnattributedUsage) group.users.add(row.user);
      accumulateProductCost(group.products, productRow);
      groups.set(name, group);
    }

    const category = classifyProductCategory(row.model, row.product, row.sku);
    if (category !== 'Coding Agent' && category !== 'Code Review') return;
    const users = category === 'Coding Agent' ? this.artifacts.codingAgent : this.artifacts.codeReview;
    const user = row.usageBucket ? getSpecialUsageBucketLabel(row.usageBucket) : row.user;
    const totals = users.get(user) ?? {
      user, quantity: 0, gross: 0, included: 0, additional: 0, first: sequence,
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

export function mergeBillingPagesArtifacts(partials: readonly BillingPagesArtifacts[]): BillingPagesArtifacts {
  const result = emptyArtifacts();
  for (const partial of partials) {
    for (const key of ['organizations', 'costCenters'] as const) {
      for (const [name, source] of partial[key]) {
        const target = result[key].get(name) ?? {
          credits: 0, products: createEmptyProductCostMap(), users: new Set<string>(), first: source.first,
        };
        target.first = Math.min(target.first, source.first);
        target.credits += source.credits;
        for (const user of source.users) target.users.add(user);
        for (const [category, product] of source.products) {
          const bucket = target.products.get(category)!;
          for (const field of ['credits', 'gross', 'discount', 'net', 'aicQuantity', 'aicGrossAmount'] as const) {
            bucket[field] += product[field];
          }
        }
        result[key].set(name, target);
      }
    }
    for (const key of ['codingAgent', 'codeReview'] as const) {
      for (const [user, source] of partial[key]) {
        const target = result[key].get(user) ?? {
          user, quantity: 0, gross: 0, included: 0, additional: 0, first: source.first,
        };
        target.first = Math.min(target.first, source.first);
        for (const field of ['quantity', 'gross', 'included', 'additional'] as const) target[field] += source[field];
        result[key].set(user, target);
      }
    }
  }
  return result;
}

export class BillingPagesAggregator extends MonthlyAggregator<BillingPagesArtifacts> {
  constructor() {
    super('billingPages', () => new BillingPagesPartialAggregator(), mergeBillingPagesArtifacts);
  }
}

export function selectBillingPagesArtifacts(
  artifacts: MonthlyArtifacts<BillingPagesArtifacts>,
  months: readonly string[],
): BillingPagesArtifacts {
  if (months.length === 0) return artifacts;
  const selected = new Set(months);
  return mergeBillingPagesArtifacts([...artifacts.byMonth]
    .filter(([month]) => selected.has(month)).map(([, partial]) => partial));
}

export function buildBillingGroupRows(groups: Map<string, BillingPageGroup>) {
  return [...groups].map(([name, group]) => ({
    name, credits: group.credits, users: group.users.size, first: group.first,
    products: getPopulatedProductCosts(group.products),
  })).sort((a, b) => a.first - b.first);
}

export function buildAgentBillingRows(users: Map<string, AgentBillingTotals>): AgentBillingTotals[] {
  return [...users.values()]
    .filter(row => row.quantity > 0 || row.gross > 0 || row.included > 0 || row.additional > 0)
    .sort((a, b) => b.quantity - a.quantity || a.first - b.first);
}
