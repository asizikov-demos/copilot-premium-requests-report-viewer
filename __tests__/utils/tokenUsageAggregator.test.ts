import type { ProcessedData } from '@/types/csv';
import {
  buildNormalizedRowFromProcessedData,
  buildTokenUsageArtifactsFromProcessedData,
  TokenUsageAggregator,
} from '@/utils/ingestion';
import type { AggregatorContext, NormalizedRow } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';
import { makeProcessedData } from '../helpers/testUtils';

describe('TokenUsageAggregator', () => {
  const ctx: AggregatorContext = { pricing: PRICING };

  function aggregate(rows: NormalizedRow[]) {
    const aggregator = new TokenUsageAggregator();
    aggregator.init?.(ctx);
    rows.forEach(row => aggregator.onRow(row, ctx));
    return aggregator.finalize(ctx);
  }

  it('aggregates overall, model, user, and UTC day-model token totals', () => {
    const artifacts = aggregate([
      makeNormalizedRow({
        day: '2025-06-01',
        user: 'test-user-one',
        model: 'test-model-one',
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 2,
      }),
      makeNormalizedRow({
        day: '2025-06-01',
        user: 'test-user-one',
        model: 'test-model-one',
        inputTokens: 3,
        cacheWriteTokens: 7,
      }),
      makeNormalizedRow({
        day: '2025-06-02',
        user: 'test-user-two',
        model: 'test-model-two',
        outputTokens: 11,
        cacheReadTokens: 0,
      }),
    ]);

    expect(artifacts).toMatchObject({
      overall: {
        inputTokens: 13,
        outputTokens: 16,
        cacheReadTokens: 2,
        cacheWriteTokens: 7,
      },
      tokenRowCount: 3,
      hasTokenData: true,
    });
    expect(artifacts.byModel.get('test-model-one')).toEqual({
      inputTokens: 13,
      outputTokens: 5,
      cacheReadTokens: 2,
      cacheWriteTokens: 7,
    });
    expect(artifacts.byUser.get('test-user-two')).toEqual({
      outputTokens: 11,
      cacheReadTokens: 0,
    });
    expect(artifacts.byDayAndModel.get('2025-06-01')?.get('test-model-one')).toEqual({
      inputTokens: 13,
      outputTokens: 5,
      cacheReadTokens: 2,
      cacheWriteTokens: 7,
    });
  });

  it('keeps unavailable token fields undefined and excludes legacy rows from token counts', () => {
    const artifacts = aggregate([
      makeNormalizedRow({ user: 'test-user-one', model: 'test-model-one' }),
      makeNormalizedRow({ user: 'test-user-two', model: 'test-model-two', inputTokens: 0 }),
    ]);

    expect(artifacts).toEqual({
      overall: { inputTokens: 0 },
      byModel: new Map([['test-model-two', { inputTokens: 0 }]]),
      byUser: new Map([['test-user-two', { inputTokens: 0 }]]),
      byDayAndModel: new Map([[
        '2025-06-01',
        new Map([['test-model-two', { inputTokens: 0 }]]),
      ]]),
      tokenRowCount: 1,
      hasTokenData: true,
    });
    expect(artifacts.overall.outputTokens).toBeUndefined();
    expect(artifacts.overall.cacheReadTokens).toBeUndefined();
    expect(artifacts.overall.cacheWriteTokens).toBeUndefined();
  });

  it('returns empty artifacts when no source token values are available', () => {
    const artifacts = aggregate([makeNormalizedRow()]);

    expect(artifacts).toEqual({
      overall: {},
      byModel: new Map(),
      byUser: new Map(),
      byDayAndModel: new Map(),
      tokenRowCount: 0,
      hasTokenData: false,
    });
  });

  it('preserves token values through the processed-data adapter and rebuilds filtered artifacts', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({
        timestamp: new Date('2025-06-30T23:59:59Z'),
        inputTokens: 10,
        outputTokens: 5,
      }),
      makeProcessedData({
        timestamp: new Date('2025-07-01T00:00:00Z'),
        inputTokens: 4,
        cacheWriteTokens: 2,
      }),
    ];

    expect(buildNormalizedRowFromProcessedData(rows[0])).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
    });

    const juneArtifacts = buildTokenUsageArtifactsFromProcessedData(
      rows.filter(row => row.monthKey === '2025-06')
    );

    expect(juneArtifacts.overall).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(juneArtifacts.byDayAndModel.get('2025-06-30')?.get('test-model')).toEqual({
      inputTokens: 10,
      outputTokens: 5,
    });
    expect(juneArtifacts.tokenRowCount).toBe(1);
  });
});
