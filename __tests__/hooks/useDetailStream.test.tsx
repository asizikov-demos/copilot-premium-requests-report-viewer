import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AnalysisProvider } from '@/context/AnalysisContext';
import { useDetailStream } from '@/hooks/useDetailStream';
import { streamFile } from '@/utils/ingestion/streamFile';
import type { IngestionResult } from '@/utils/ingestion/types';
import { DetailAggregator } from '@/utils/ingestion/DetailAggregator';

import { detailFixture } from '../helpers/detailFixtures';
import { ingestRows } from '../helpers/aggregateRows';
import { makeUsageRow } from '../helpers/testUtils';

jest.mock('@/utils/ingestion/streamFile', () => ({
  ...jest.requireActual('@/utils/ingestion/streamFile'),
  streamFile: jest.fn(),
}));
const mockedStream = jest.mocked(streamFile);

function output(): IngestionResult {
  const { details, tokens } = detailFixture([makeUsageRow({ inputTokens: 10 })]);
  const aggregator = new DetailAggregator();
  aggregator.onRow(makeUsageRow({ inputTokens: 10 }));
  return { outputs: { details: aggregator.finalize(), tokens }, rowsProcessed: details.consumption.credits.rowCount, durationMs: 1, warnings: [] };
}

describe('useDetailStream lifecycle', () => {
  let file: File;
  function Wrapper({ children }: { children: ReactNode }) {
    return <AnalysisProvider sourceFile={file} ingestionResult={ingestRows([makeUsageRow()])}
      filename="test-report.csv" onReset={() => {}}>{children}</AnalysisProvider>;
  }
  beforeEach(() => {
    mockedStream.mockReset();
    file = new File(['test'], 'test-report.csv');
  });

  it('reports progress, caches completed results across remounts, and scopes the cache to File identity', async () => {
    let finish!: (value: IngestionResult) => void;
    mockedStream.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = renderHook(() => useDetailStream({ user: 'test-user-one' }), { wrapper: Wrapper });
    expect(first.result.current.data).toBeUndefined();
    expect(mockedStream).toHaveBeenCalledWith(file, ['details', 'tokens'], {
      user: 'test-user-one', organization: undefined, costCenter: undefined,
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

  it('cancels on filter changes and unmount, ignores late results, and reuses unchanged filters', async () => {
    const finishes: ((value: IngestionResult) => void)[] = [];
    mockedStream.mockImplementation(() => new Promise(resolve => finishes.push(resolve)));
    const hook = renderHook(({ user }) => useDetailStream({ user }), {
      wrapper: Wrapper, initialProps: { user: 'test-user-one' },
    });
    const firstSignal = mockedStream.mock.calls[0][3]?.signal;
    hook.rerender({ user: 'test-user-one' });
    expect(mockedStream).toHaveBeenCalledTimes(1);
    hook.rerender({ user: 'test-user-two' });
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => finishes[0](output()));
    expect(hook.result.current.data).toBeUndefined();
    await act(async () => finishes[1](output()));
    expect(hook.result.current.data).toBeDefined();
    hook.rerender({ user: 'test-user-three' });
    expect(hook.result.current.data).toBeUndefined();
    expect(mockedStream.mock.calls[2][2]?.user).toBe('test-user-three');
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
