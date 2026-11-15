import { createIngestionWorker } from '@/utils/ingestion/createIngestionWorker';
import { streamFile } from '@/utils/ingestion/streamFile';
import type { DailyBucketsArtifacts, UsageArtifacts } from '@/utils/ingestion/types';
import type { IngestionResponse } from '@/utils/ingestion/workerProtocol';

import { createStreamingFile as createFile, MockFileReader } from '../helpers/streamingFile';

jest.mock('@/utils/ingestion/createIngestionWorker', () => ({
  createIngestionWorker: jest.fn(),
}));

const csv = [
  'date,username,sku,model,quantity,organization,cost_center_name',
  '2026-07-01T00:00:00Z,test-user-two,copilot_ai_credit,test-model-one,2,test-org-one,test-cost-center-one',
  '2026-07-01T00:30:00Z,test-user-one,copilot_ai_credit,test-model-one,3,test-org-one,test-cost-center-one',
  '2026-07-02,test-user-two,copilot_ai_credit,test-model-one,5,test-org-one,test-cost-center-two',
  '2026-07-03,test-user-one,copilot_ai_credit,test-model-one,7,,',
].join('\n');

describe('streamFile without Worker support', () => {
  const originalFileReader = globalThis.FileReader;

  beforeEach(() => {
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  });

  afterEach(() => {
    globalThis.FileReader = originalFileReader;
  });

  it('streams all report rows through the selected aggregators', async () => {
    const file = createFile(csv);
    const result = await streamFile(file, ['usage', 'dailyBuckets'], { chunkSize: 64 });

    expect(result.rowsProcessed).toBe(4);
    expect((result.outputs.usage as UsageArtifacts).users).toEqual([
      expect.objectContaining({ user: 'test-user-two', totalCredits: 7 }),
      expect.objectContaining({ user: 'test-user-one', totalCredits: 10 }),
    ]);
    expect([...(result.outputs.dailyBuckets as DailyBucketsArtifacts).dailyUserTotals.keys()])
      .toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(result.warnings).toEqual([]);

  });

  it('rejects parser errors instead of resolving a partial result', async () => {
    const file = createFile(
      'date,username,sku,model,quantity\n2026-07-01,test-user-one,copilot_ai_credit,test-model-one,1,extra',
    );
    await expect(streamFile(file, ['usage'])).rejects.toThrow('CSV parsing error:');
  });

  it('skips transitional legacy rows in a supported export', async () => {
    const file = createFile([
      csv,
      '2026-07-04,test-user-two,copilot_premium_request,test-model-one,1,,',
    ].join('\n'));
    const result = await streamFile(file, ['usage']);
    expect(result.rowsProcessed).toBe(4);
    expect((result.outputs.usage as UsageArtifacts).users).toHaveLength(2);
  });

  it('cancels the main-thread fallback before processing another chunk', async () => {
    const controller = new AbortController();
    const onProgress = jest.fn(() => controller.abort());
    await expect(streamFile(createFile(csv), ['usage'], {
      chunkSize: 64, signal: controller.signal, onProgress,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});

describe('streamFile worker transport', () => {
  const originalWorker = globalThis.Worker;
  const postMessage = jest.fn();
  const terminate = jest.fn();
  let worker: Worker;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.Worker = jest.fn();
    worker = { postMessage, terminate } as unknown as Worker;
    jest.mocked(createIngestionWorker).mockReturnValue(worker);
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  async function start() {
    const file = new File([csv], 'test-usage.csv');
    const onProgress = jest.fn();
    const result = streamFile(file, ['usage'], { onProgress });
    await Promise.resolve();
    return { file, onProgress, result };
  }

  it('sends the File and aggregator ids, forwards progress, and preserves opaque Maps/Sets', async () => {
    const { file, onProgress, result } = await start();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      file,
      aggregatorIds: ['usage'],
    }));
    const send = (data: IngestionResponse) => worker.onmessage?.(new MessageEvent('message', { data }));
    send({ type: 'progress', progress: { rowsProcessed: 1000 } });
    expect(onProgress).toHaveBeenCalledWith({ rowsProcessed: 1000 });

    const output = {
      outputs: { usage: new Map([['2026-07', { users: new Set(['test-user-one']) }]]) },
      rowsProcessed: 1000,
      durationMs: 1,
      warnings: [],
    };
    send({ type: 'complete', result: output });
    await expect(result).resolves.toBe(output);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it.each(['ingestion', 'runtime', 'deserialization', 'postMessage'])('rejects %s failures and terminates the worker', async failure => {
    if (failure === 'postMessage') postMessage.mockImplementationOnce(() => { throw new Error('transfer failed'); });
    const { result } = await start();
    const rejection = expect(result).rejects.toThrow();
    if (failure === 'ingestion') {
      worker.onmessage?.(new MessageEvent('message', { data: { type: 'error', error: 'parse failed' } }));
    } else if (failure === 'runtime') {
      worker.onerror?.(new ErrorEvent('error', { message: 'worker failed', cancelable: true }));
    } else if (failure === 'deserialization') {
      worker.onmessageerror?.(new MessageEvent('messageerror'));
    }
    await rejection;
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates an in-flight worker when cancelled', async () => {
    const controller = new AbortController();
    const result = streamFile(new File([csv], 'test-report.csv'), ['usage'], { signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('does not create a worker for a request cancelled before start', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(streamFile(new File([csv], 'test-report.csv'), ['usage'], { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(createIngestionWorker).not.toHaveBeenCalled();
  });
});
