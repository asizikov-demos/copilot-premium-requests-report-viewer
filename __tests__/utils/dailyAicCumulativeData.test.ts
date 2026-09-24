import { PRICING } from '@/constants/pricing';
import {
  buildDailyCumulativeDataFromArtifacts,
  buildUserDailyModelDataFromArtifacts,
  DailyBucketsAggregator,
} from '@/utils/ingestion';
import type { UsageArtifacts } from '@/utils/ingestion';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

describe('canonical AI-credit daily aggregates', () => {
  it('builds consistent cumulative per-user AI Credits', () => {
    const aggregator = new DailyBucketsAggregator();
    const ctx = { pricing: PRICING };
    aggregator.init(ctx);

    aggregator.onRow(makeNormalizedRow({
      day: '2026-06-01',
      date: '2026-06-01',
      user: 'test-user-one',
      quantity: 1.5,
      billingQuantity: 1.5,
      aicQuantity: 1.5,
      usageUnit: 'ai_credit',
    }), ctx);
    aggregator.onRow(makeNormalizedRow({
      day: '2026-06-01',
      date: '2026-06-01',
      user: 'test-user-two',
      quantity: 2,
      billingQuantity: 2,
      usageUnit: 'ai_credit',
    }), ctx);
    aggregator.onRow(makeNormalizedRow({
      day: '2026-06-02',
      date: '2026-06-02',
      user: 'test-user-one',
      quantity: 3.25,
      billingQuantity: 3.25,
      aicQuantity: 3.25,
      usageUnit: 'ai_credit',
    }), ctx);
    const artifacts = aggregator.finalize(ctx);

    expect(buildDailyCumulativeDataFromArtifacts(artifacts)).toEqual([
      {
        date: '2026-06-01',
        'test-user-one': 1.5,
        'test-user-two': 2,
      },
      {
        date: '2026-06-02',
        'test-user-one': 4.75,
        'test-user-two': 2,
      },
    ]);

  });

  it('builds cumulative per-model AI Credits for user detail charts', () => {
    const aggregator = new DailyBucketsAggregator();
    const ctx = { pricing: PRICING };
    aggregator.init(ctx);

    aggregator.onRow(makeNormalizedRow({
      day: '2026-06-01',
      date: '2026-06-01',
      user: 'test-user-one',
      model: 'test-model-one',
      quantity: 1.5,
      billingQuantity: 1.5,
      aicQuantity: 1.5,
      usageUnit: 'ai_credit',
    }), ctx);
    aggregator.onRow(makeNormalizedRow({
      day: '2026-06-01',
      date: '2026-06-01',
      user: 'test-user-one',
      model: 'test-model-two',
      quantity: 2,
      billingQuantity: 2,
      aicQuantity: 2,
      usageUnit: 'ai_credit',
    }), ctx);
    aggregator.onRow(makeNormalizedRow({
      day: '2026-06-02',
      date: '2026-06-02',
      user: 'test-user-one',
      model: 'test-model-one',
      quantity: 3.25,
      billingQuantity: 3.25,
      aicQuantity: 3.25,
      usageUnit: 'ai_credit',
    }), ctx);

    const usageArtifacts: UsageArtifacts = {
      users: [{
        user: 'test-user-one',
        totalCredits: 6.75,
        modelBreakdown: {
          'test-model-one': 4.75,
          'test-model-two': 2,
        },
      }],
      modelTotals: {
        'test-model-one': 4.75,
        'test-model-two': 2,
      },
      userCount: 1,
      modelCount: 2,
    };

    expect(buildUserDailyModelDataFromArtifacts(
      aggregator.finalize(ctx),
      usageArtifacts,
      'test-user-one'
    )).toEqual([
      {
        date: '2026-06-01',
        totalCumulative: 3.5,
        'test-model-one': 1.5,
        'test-model-two': 2,
      },
      {
        date: '2026-06-02',
        totalCumulative: 6.75,
        'test-model-one': 3.25,
        'test-model-two': 0,
      },
    ]);
  });
});
