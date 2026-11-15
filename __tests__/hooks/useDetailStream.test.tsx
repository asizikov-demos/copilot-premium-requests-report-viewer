import { act, renderHook, waitFor } from '@testing-library/react';
import type { ContextType, ReactNode } from 'react';

import { AnalysisContext } from '@/context/AnalysisContext';
import { useDetailStream } from '@/hooks/useDetailStream';
import { streamFile } from '@/utils/ingestion/streamFile';
import type { IngestionResult } from '@/utils/ingestion/types';

import { detailFixture } from '../helpers/detailFixtures';
import { makeUsageRow } from '../helpers/testUtils';

jest.mock('@/utils/ingestion/streamFile', () => ({ streamFile: jest.fn() }));
const mockedStream = jest.mocked(streamFile);

function output(): IngestionResult {
  const { details, tokens } = detailFixture([makeUsageRow({ inputTokens: 10 })]);
  return { outputs: { details, tokens }, rowsProcessed: 1, durationMs: 1, warnings: [] };
}

describe('useDetailStream lifecycle', () => {
  let file: File;
  let months: string[];
  function Wrapper({ children }: { children: ReactNode }) {
    const value = {
      sourceFile: file, selectedMonths: months,
      availableMonths: [{ value: '2026-06', label: 'June 2026' }, { value: '2026-07', label: 'July 2026' }],
    } as ContextType<typeof AnalysisContext>;
    return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
  }
  beforeEach(() => {
    mockedStream.mockReset();
    file = new File(['test'], 'test-report.csv');
    months = [];
  });

  it('reports progress, caches completed results across remounts, and scopes the cache to File identity', async () => {
    let finish!: (value: IngestionResult) => void;
    mockedStream.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = renderHook(() => useDetailStream({ user: 'test-user-one' }), { wrapper: Wrapper });
    expect(first.result.current.data).toBeUndefined();
    expect(mockedStream).toHaveBeenCalledWith(file, ['details', 'tokens'], {
      user: 'test-user-one', months: [], organization: undefined, costCenter: undefined,
    }, expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }));
    act(() => mockedStream.mock.calls[0][3]?.onProgress?.({ rowsProcessed: 1, rowsScanned: 10000 }));
    expect(first.result.current.progress?.rowsScanned).toBe(10000);
    await act(async () => finish(output()));
    expect(first.result.current.data?.tokens.totals.inputTokens).toBe(10);
    first.unmount();
    const cached = renderHook(() => useDetailStream({ user: 'test-user-one' }), { wrapper: Wrapper });
    expect(cached.result.current.data).toBeDefined();
    expect(mockedStream).toHaveBeenCalledTimes(1);
    file = new File(['test'], 'test-report.csv');
    cached.rerender();
    expect(cached.result.current.data).toBeUndefined();
    expect(mockedStream).toHaveBeenCalledTimes(2);
    cached.unmount();
  });

  it('cancels on filter/month changes and unmount, ignores late results, and canonicalizes month order', async () => {
    const finishes: ((value: IngestionResult) => void)[] = [];
    mockedStream.mockImplementation(() => new Promise(resolve => finishes.push(resolve)));
    months = ['2026-07', '2026-06'];
    const hook = renderHook(({ user }) => useDetailStream({ user }), {
      wrapper: Wrapper, initialProps: { user: 'test-user-one' },
    });
    const firstSignal = mockedStream.mock.calls[0][3]?.signal;
    months = ['2026-06', '2026-07'];
    hook.rerender({ user: 'test-user-one' });
    expect(mockedStream).toHaveBeenCalledTimes(1);
    hook.rerender({ user: 'test-user-two' });
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => finishes[0](output()));
    expect(hook.result.current.data).toBeUndefined();
    await act(async () => finishes[1](output()));
    expect(hook.result.current.data).toBeDefined();
    months = ['2026-07'];
    hook.rerender({ user: 'test-user-two' });
    expect(hook.result.current.data).toBeUndefined();
    expect(mockedStream.mock.calls[2][2]?.months).toEqual(['2026-07']);
    const lastSignal = mockedStream.mock.calls[2][3]?.signal;
    hook.unmount();
    expect(lastSignal?.aborted).toBe(true);
  });

  it('surfaces failures instead of caching partial or failed aggregates', async () => {
    mockedStream.mockRejectedValueOnce(new Error('File reading error'));
    const hook = renderHook(() => useDetailStream({ organization: 'Unassigned' }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.error).toBe('File reading error'));
    expect(hook.result.current.data).toBeUndefined();
    hook.unmount();
    mockedStream.mockResolvedValueOnce({ ...output(), outputs: { details: null, tokens: null }, warnings: ['Aggregator details finalize error'] });
    const retry = renderHook(() => useDetailStream({ organization: 'Unassigned' }), { wrapper: Wrapper });
    await waitFor(() => expect(retry.result.current.error).toContain('Aggregator details finalize error'));
    retry.unmount();
  });
});
