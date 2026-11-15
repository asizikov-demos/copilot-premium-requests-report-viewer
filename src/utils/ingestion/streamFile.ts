import type { AggregatorId } from './registry';
import type { IngestionProgress, IngestionResult } from './types';
import type { IngestionRequest, IngestionResponse } from './workerProtocol';

export type { AggregatorId } from './registry';

export const REPORT_AGGREGATOR_IDS = [
  'quota', 'usage', 'dailyBuckets', 'featureUsage', 'billing', 'billingPages', 'tokens', 'modelDaily', 'detailPages',
] as const satisfies readonly AggregatorId[];

export interface StreamFileOptions {
  signal?: AbortSignal;
  chunkSize?: number;
  progressResolution?: number;
  onProgress?: (progress: IngestionProgress) => void;
}

/** Each call owns a fresh worker and aggregates; the File is never read into memory here. */
export async function streamFile(
  file: File,
  aggregatorIds: readonly AggregatorId[],
  options: StreamFileOptions = {},
): Promise<IngestionResult> {
  options.signal?.throwIfAborted();
  const request: IngestionRequest = {
    file,
    aggregatorIds,
    chunkSize: options.chunkSize,
    progressResolution: options.progressResolution,
  };

  if (typeof Worker === 'undefined') {
    const { runFileIngestion } = await import('./runFileIngestion');
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('CSV ingestion cancelled', 'AbortError'));
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) {
        abort();
        return;
      }
      runFileIngestion(request, response => {
        if (response.type === 'progress') options.onProgress?.(response.progress);
        else {
          options.signal?.removeEventListener('abort', abort);
          if (response.type === 'complete') resolve(response.result);
          else reject(new Error(response.error));
        }
      }, options.signal);
    });
  }

  const { createIngestionWorker } = await import('./createIngestionWorker');
  const worker = createIngestionWorker();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('CSV ingestion cancelled', 'AbortError'));
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    worker.onmessage = (event: MessageEvent<IngestionResponse>) => {
      const response = event.data;
      if (response.type === 'progress') {
        options.onProgress?.(response.progress);
      } else if (response.type === 'complete') {
        cleanup();
        resolve(response.result);
      } else {
        fail(response.error);
      }
    };
    worker.onerror = event => {
      event.preventDefault();
      fail(event.message || 'CSV ingestion worker failed');
    };
    worker.onmessageerror = () => fail('Failed to receive CSV ingestion results');
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    try {
      worker.postMessage(request);
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed to send file to ingestion worker');
    }
  });
}
