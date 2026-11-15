import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { PRICING } from '@/constants/pricing';
import { AnalysisProvider, useAnalysisContext } from '@/context/AnalysisContext';
import {
  BillingAggregator,
  BillingPagesAggregator,
  ModelDailyAggregator,
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  QuotaAggregator,
  RawDataAggregator,
  TokenAggregator,
  UsageAggregator,
} from '@/utils/ingestion';
import type { Aggregator, IngestionResult } from '@/utils/ingestion';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

function createResult(includeRaw: boolean, includeTokens: boolean): IngestionResult {
  const rows = [
    makeNormalizedRow({ date: '2026-06-30', day: '2026-06-30', inputTokens: 100 }),
    makeNormalizedRow({ date: '2026-07-01', day: '2026-07-01', inputTokens: 0 }),
    makeNormalizedRow({ date: '2026-08-01', day: '2026-08-01' }),
  ];
  const aggregators: Aggregator[] = [
    new UsageAggregator(), new QuotaAggregator(), new DailyBucketsAggregator(), new FeatureUsageAggregator(),
    new BillingAggregator(), new BillingPagesAggregator(), new ModelDailyAggregator(),
    ...(includeRaw ? [new RawDataAggregator()] : []),
    ...(includeTokens ? [new TokenAggregator()] : []),
  ];
  const context = { pricing: PRICING };
  const outputs: Record<string, unknown> = {};
  for (const aggregator of aggregators) {
    aggregator.init?.(context);
    rows.forEach(row => aggregator.onRow(row, context));
    outputs[aggregator.id] = aggregator.finalize(context);
  }
  return { outputs, rowsProcessed: rows.length, durationMs: 0, warnings: [] };
}

describe('month-filtered token artifacts in analysis context', () => {
  it.each([
    { raw: true, tokens: true },
    { raw: false, tokens: true },
  ])('supports raw=$raw, streaming tokens=$tokens', ({ raw, tokens }) => {
    const ingestionResult = createResult(raw, tokens);
    const { result } = renderHook(() => useAnalysisContext(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnalysisProvider ingestionResult={ingestionResult} filename="test-report.csv" onReset={() => {}}>
          {children}
        </AnalysisProvider>
      ),
    });
    expect(result.current.tokenArtifacts?.totals.inputTokens).toBe(100);
    const allMonths = result.current.modelDailyArtifacts;
    expect(allMonths.rowCount).toBe(3);
    act(() => result.current.setView('modelTrends'));
    expect(result.current.modelDailyArtifacts).toBe(allMonths);
    act(() => result.current.setSelectedMonths(['2026-07']));
    expect(result.current.tokenArtifacts?.totals).toMatchObject({ inputTokens: 0, rowCount: 1 });
    expect(result.current.modelDailyArtifacts).toMatchObject({ rowCount: 1, months: ['2026-07'] });
    expect(result.current.tokenArtifacts?.hasAnyTokenData).toBe(true);
    act(() => result.current.setSelectedMonths(['2026-08']));
    expect(result.current.tokenArtifacts?.totals.inputTokens).toBeUndefined();
    expect(result.current.tokenArtifacts?.hasAnyTokenData).toBe(false);
    act(() => result.current.setSelectedMonths([]));
    expect(result.current.tokenArtifacts?.totals).toMatchObject({ inputTokens: 100, rowCount: 3 });
  });

  it.each([true, false])('does not rebuild absent token artifacts from rows (raw=%s)', raw => {
    const ingestionResult = createResult(raw, false);
    const { result } = renderHook(() => useAnalysisContext(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnalysisProvider ingestionResult={ingestionResult} filename="test-report.csv" onReset={() => {}}>
          {children}
        </AnalysisProvider>
      ),
    });
    expect(result.current.tokenArtifacts).toBeUndefined();
    act(() => result.current.setSelectedMonths(['2026-07']));
    expect(result.current.tokenArtifacts).toBeUndefined();
  });

  it('uses streamed core and billing partials even when retained rows differ', () => {
    const ingestionResult = createResult(true, true);
    ingestionResult.outputs.rawData = [];
    const { result } = renderHook(() => useAnalysisContext(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnalysisProvider ingestionResult={ingestionResult} filename="test-report.csv" onReset={() => {}}>
          {children}
        </AnalysisProvider>
      ),
    });
    expect(result.current.billingArtifacts?.users[0].quantity).toBe(3);
    expect(result.current.usageArtifacts.users[0].totalCredits).toBe(3);
    expect(result.current.availableMonths).toHaveLength(3);
    act(() => result.current.setSelectedMonths(['2026-07']));
    expect(result.current.billingArtifacts?.users[0].quantity).toBe(1);
    expect(result.current.usageArtifacts.users[0].totalCredits).toBe(1);
    expect(result.current.userData[0].totalCredits).toBe(1);
    expect(result.current.baseProcessed).toEqual([]);
  });

  it('preserves a failed token artifact instead of rebuilding partial data from raw rows', () => {
    const ingestionResult = createResult(true, true);
    ingestionResult.outputs.tokens = null;
    ingestionResult.warnings = ['Aggregator tokens finalize error: Token total exceeds the safe integer range'];
    const { result } = renderHook(() => useAnalysisContext(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnalysisProvider ingestionResult={ingestionResult} filename="test-report.csv" onReset={() => {}}>
          {children}
        </AnalysisProvider>
      ),
    });
    expect(result.current.tokenArtifacts).toBeNull();
    act(() => result.current.setSelectedMonths(['2026-07']));
    expect(result.current.tokenArtifacts).toBeNull();
    expect(result.current.processedData).toHaveLength(1);
  });
});
