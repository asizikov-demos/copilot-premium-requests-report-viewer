import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AnalysisProvider, useAnalysisContext } from '@/context/AnalysisContext';
import type { IngestionResult } from '@/utils/ingestion';

import { ingestRows } from '../helpers/aggregateRows';
import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

function createResult(): IngestionResult {
  return ingestRows([
    makeNormalizedRow({ date: '2026-06-30', day: '2026-06-30', inputTokens: 100 }),
    makeNormalizedRow({ date: '2026-07-01', day: '2026-07-01', inputTokens: 0 }),
    makeNormalizedRow({ date: '2026-08-01', day: '2026-08-01' }),
  ]);
}

function wrapper(ingestionResult: IngestionResult) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AnalysisProvider ingestionResult={ingestionResult} filename="test-report.csv" onReset={() => {}}>
      {children}
    </AnalysisProvider>;
  };
}

describe('month-filtered artifacts in analysis context', () => {
  it('preserves reported zero, missing tokens and all-month selection', () => {
    const { result } = renderHook(() => useAnalysisContext(), { wrapper: wrapper(createResult()) });
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

  it('preserves absent token artifacts instead of rebuilding them', () => {
    const ingestionResult = createResult();
    delete ingestionResult.outputs.tokens;
    const { result } = renderHook(() => useAnalysisContext(), { wrapper: wrapper(ingestionResult) });
    expect(result.current.tokenArtifacts).toBeUndefined();
    act(() => result.current.setSelectedMonths(['2026-07']));
    expect(result.current.tokenArtifacts).toBeUndefined();
  });

  it('uses streamed month partials for core, user, billing and page selectors', () => {
    const { result } = renderHook(() => useAnalysisContext(), { wrapper: wrapper(createResult()) });
    expect(result.current.billingArtifacts?.users[0].quantity).toBe(3);
    expect(result.current.usageArtifacts.users[0].totalCredits).toBe(3);
    expect(result.current.availableMonths).toHaveLength(3);
    act(() => result.current.setSelectedMonths(['2026-07']));
    expect(result.current.billingArtifacts?.users[0].quantity).toBe(1);
    expect(result.current.usageArtifacts.users[0].totalCredits).toBe(1);
    expect(result.current.userData[0].totalCredits).toBe(1);
    expect(result.current.billingPagesArtifacts.organizations.get('Unassigned')?.credits).toBe(1);
  });

  it('preserves a failed token artifact while keeping other selected metrics', () => {
    const ingestionResult = createResult();
    ingestionResult.outputs.tokens = null;
    ingestionResult.warnings = ['Aggregator tokens finalize error: Token total exceeds the safe integer range'];
    const { result } = renderHook(() => useAnalysisContext(), { wrapper: wrapper(ingestionResult) });
    expect(result.current.tokenArtifacts).toBeNull();
    act(() => result.current.setSelectedMonths(['2026-07']));
    expect(result.current.tokenArtifacts).toBeNull();
    expect(result.current.usageArtifacts.users[0].totalCredits).toBe(1);
  });
});
