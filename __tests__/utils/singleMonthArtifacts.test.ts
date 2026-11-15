/** @jest-environment node */
import { UsageAggregator } from '@/utils/ingestion';

import { aggregateRows } from '../helpers/aggregateRows';
import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

describe('single-month usage artifacts', () => {
  it('preserves tied top models, first metadata, and Coding Agent model order without partition provenance', () => {
    const artifacts = aggregateRows(new UsageAggregator(), [
      makeNormalizedRow({ model: 'test-model-one', quantity: 2 }),
      makeNormalizedRow({ model: 'test-model-two', quantity: 3, costCenter: 'test-cost-center-one', sku: 'coding_agent_ai_credit' }),
      makeNormalizedRow({ model: 'test-model-one', quantity: 1, costCenter: 'test-cost-center-two', sku: 'coding_agent_ai_credit' }),
      makeNormalizedRow({ model: 'test-model-two', quantity: 0 }),
    ]);
    expect(artifacts.users[0]).toMatchObject({
      totalCredits: 6, topModel: 'test-model-two', topModelValue: 3,
      costCenter: 'test-cost-center-one', costCenters: ['test-cost-center-one', 'test-cost-center-two'],
      codingAgentModels: ['test-model-two', 'test-model-one'],
    });
  });

  it.each(['constructor', 'toString', '__proto__'])('preserves numeric usage for the model key %s after worker transport', model => {
    const artifacts = structuredClone(aggregateRows(new UsageAggregator(), [
      makeNormalizedRow({ model, quantity: 2 }),
      makeNormalizedRow({ model, quantity: 3, user: '', isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit' }),
      makeNormalizedRow({ model, quantity: 5 }),
      makeNormalizedRow({ model, quantity: 7, user: '', isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit' }),
    ]));
    expect(artifacts.modelTotals[model]).toBe(17);
    expect(artifacts.users[0].modelBreakdown[model]).toBe(7);
    expect(artifacts.users[0]).toMatchObject({ topModel: model, topModelValue: 7 });
    expect(artifacts.specialBuckets?.[0].modelBreakdown[model]).toBe(10);
  });

  it('ranks final model totals correctly after negative corrections and does not let zero rows change ties', () => {
    const artifacts = aggregateRows(new UsageAggregator(), [
      makeNormalizedRow({ model: 'test-model-one', quantity: 3 }),
      makeNormalizedRow({ model: 'test-model-two', quantity: 2 }),
      makeNormalizedRow({ model: 'test-model-one', quantity: -1 }),
      makeNormalizedRow({ model: 'test-model-two', quantity: 0 }),
    ]);
    expect(artifacts.users[0]).toMatchObject({
      totalCredits: 4, topModel: 'test-model-two', topModelValue: 2,
    });
  });
});
