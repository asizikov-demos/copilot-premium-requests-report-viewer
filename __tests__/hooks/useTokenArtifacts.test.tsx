import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AnalysisProvider, useAnalysisContext } from '@/context/AnalysisContext';
import type { IngestionResult } from '@/utils/ingestion';

import { ingestRows } from '../helpers/aggregateRows';
import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

function createResult(): IngestionResult {
  return ingestRows([
    makeNormalizedRow({ day: '2026-06-30', inputTokens: 100 }),
    makeNormalizedRow({ day: '2026-06-01', inputTokens: 0 }),
    makeNormalizedRow({ day: '2026-06-15' }),
  ]);
}

function wrapper(ingestionResult: IngestionResult) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AnalysisProvider ingestionResult={ingestionResult} filename="test-report.csv" onReset={() => {}}>
      {children}
    </AnalysisProvider>;
  };
}

describe('single-month artifacts in analysis context', () => {
  it('exposes finalized artifacts directly and preserves zeros, missing counts, and artifact identity across views', () => {
    const ingestionResult = createResult();
    const { result } = renderHook(() => useAnalysisContext(), { wrapper: wrapper(ingestionResult) });
    expect(result.current.reportMonth).toBe('2026-06');
    expect(result.current.tokenArtifacts).toBe(ingestionResult.outputs.tokens);
    expect(result.current.usageArtifacts).toBe(ingestionResult.outputs.usage);
    expect(result.current.billingArtifacts).toBe(ingestionResult.outputs.billing);
    expect(result.current.modelDailyArtifacts).toBe(ingestionResult.outputs.modelDaily);
    expect(result.current.tokenArtifacts?.totals).toMatchObject({ inputTokens: 100, rowCount: 3 });
    expect(result.current.tokenArtifacts?.byDay.get('2026-06-01')?.totals.inputTokens).toBe(0);
    expect(result.current.tokenArtifacts?.byDay.get('2026-06-15')?.totals.inputTokens).toBeUndefined();
    expect(result.current.userData[0].totalCredits).toBe(3);
    act(() => result.current.setView('modelTrends'));
    expect(result.current.modelDailyArtifacts).toBe(ingestionResult.outputs.modelDaily);
  });

  it.each([undefined, null])('preserves absent or failed token artifacts: %s', tokens => {
    const ingestionResult = createResult();
    ingestionResult.outputs.tokens = tokens;
    const { result } = renderHook(() => useAnalysisContext(), { wrapper: wrapper(ingestionResult) });
    expect(result.current.tokenArtifacts).toBe(tokens);
    expect(result.current.usageArtifacts.users[0].totalCredits).toBe(3);
  });
});
