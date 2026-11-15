/** @jest-environment node */
import { PRICING } from '@/constants/pricing';
import {
  BillingPagesAggregator, buildAgentBillingRows, buildBillingGroupRows,
  getSpecialUsageBucketLabel, selectBillingPagesArtifacts, UNASSIGNED_BILLING_GROUP,
  type NormalizedRow,
} from '@/utils/ingestion';
import { classifyProductCategory } from '@/utils/productClassification';
import { accumulateProductCost, createEmptyProductCostMap, getPopulatedProductCosts } from '@/utils/productCosts';

import { aggregateRows } from '../helpers/aggregateRows';
import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

const rows = [
  makeNormalizedRow({ day: '2026-06-30', user: 'test-user-one', model: 'test-model-one',
    quantity: 2, organization: 'test-org-one', costCenter: 'test-cost-center-one', grossAmount: 1 }),
  makeNormalizedRow({ day: '2026-08-01', user: 'test-user-two', model: 'test-model-two',
    quantity: 3, sku: 'coding_agent_ai_credit', organization: 'test-org-two', grossAmount: 0, aicGrossAmount: 10 }),
  makeNormalizedRow({ day: '2026-06-01', user: 'test-user-one', model: 'Coding Agent model',
    quantity: 3, organization: 'test-org-one', costCenter: 'test-cost-center-two', aicGrossAmount: 2 }),
  makeNormalizedRow({ day: '2026-07-01', user: 'test-user-three', model: 'Code Review model',
    quantity: 5, discountAmount: 1, netAmount: 2, organization: 'test-org-three' }),
  makeNormalizedRow({ day: '2026-06-02', user: '', model: 'Code Review model',
    quantity: 1, isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit', grossAmount: 0.1 }),
  makeNormalizedRow({ day: '2026-08-02', user: 'test-user-one', model: 'Coding Agent model',
    quantity: 2, netAmount: 0, organization: 'test-org-one', costCenter: 'test-cost-center-two' }),
  makeNormalizedRow({ day: '2026-08-03', user: 'test-user-four', model: 'Code Review model',
    quantity: 0, grossAmount: -1, discountAmount: -1, netAmount: -1 }),
  makeNormalizedRow({ day: '2026-07-02', user: 'test-user-one', model: 'test-model-three',
    quantity: 0, product: 'spark', organization: 'test-org-one', costCenter: 'test-cost-center-one' }),
];

function referenceGroups(source: NormalizedRow[], field: 'organization' | 'costCenter') {
  const groups = new Map<string, {
    credits: number; users: Set<string>; products: ReturnType<typeof createEmptyProductCostMap>;
  }>();
  for (const row of source) {
    const name = row[field] || UNASSIGNED_BILLING_GROUP;
    const group = groups.get(name) ?? { credits: 0, users: new Set<string>(), products: createEmptyProductCostMap() };
    group.credits += row.quantity;
    if (!row.isUnattributedUsage) group.users.add(row.user);
    accumulateProductCost(group.products, row);
    groups.set(name, group);
  }
  return [...groups].map(([name, group]) => ({
    name, credits: group.credits, users: group.users.size, products: getPopulatedProductCosts(group.products),
  }));
}

function referenceAgents(source: NormalizedRow[], category: string) {
  const users = new Map<string, { user: string; quantity: number; gross: number; included: number; additional: number }>();
  for (const row of source) {
    if (classifyProductCategory(row.model, row.product, row.sku) !== category) continue;
    const user = row.usageBucket ? getSpecialUsageBucketLabel(row.usageBucket) : row.user;
    const current = users.get(user) ?? { user, quantity: 0, gross: 0, included: 0, additional: 0 };
    current.quantity += row.quantity;
    current.gross += row.grossAmount ?? row.aicGrossAmount ?? 0;
    current.included += row.discountAmount ?? 0;
    current.additional += row.netAmount ?? 0;
    users.set(user, current);
  }
  return [...users.values()]
    .filter(row => row.quantity > 0 || row.gross > 0 || row.included > 0 || row.additional > 0)
    .sort((a, b) => b.quantity - a.quantity);
}

describe('month-keyed billing page view models', () => {
  it.each([[], ['2026-06'], ['2026-08', '2026-06'], ['2026-09'], ['2026-06', '2026-06']])(
    'matches the original row reductions for months %j', (...months) => {
      const artifacts = structuredClone(aggregateRows(new BillingPagesAggregator(), rows));
      const before = structuredClone(artifacts);
      const selected = selectBillingPagesArtifacts(artifacts, months);
      const source = months.length ? rows.filter(row => months.includes(row.day.slice(0, 7))) : rows;
      for (const [groups, field] of [
        [selected.organizations, 'organization'], [selected.costCenters, 'costCenter'],
      ] as const) {
        expect(buildBillingGroupRows(groups).map(({ first: _first, ...row }) => row)).toEqual(referenceGroups(source, field));
      }
      for (const [users, category] of [[selected.codingAgent, 'Coding Agent'], [selected.codeReview, 'Code Review']] as const) {
        expect(buildAgentBillingRows(users).map(({ first: _first, ...row }) => row)).toEqual(referenceAgents(source, category));
      }
      expect(artifacts).toEqual(before);
    },
  );

  it('keeps state bounded by month/group/user/product keys, not input row count', () => {
    const aggregator = new BillingPagesAggregator();
    const context = { pricing: PRICING };
    const row = rows[0];
    for (let index = 0; index < 10000; index++) aggregator.onRow(row, context);
    const result = aggregator.finalize();
    expect(result.byMonth.size).toBe(1);
    expect(result.organizations.size).toBe(1);
    expect(result.organizations.get('test-org-one')?.users.size).toBe(1);
    expect(result.organizations.get('test-org-one')?.credits).toBe(20000);
  });
});
