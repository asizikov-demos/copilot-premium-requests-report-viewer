import type { AggregatorId } from './registry';
import type { IngestionProgress, IngestionResult, RowFilter } from './types';
import type { IngestionRequest, IngestionResponse } from './workerProtocol';

export type { AggregatorId } from './registry';
export type { RowFilter } from './types';

export const REPORT_AGGREGATOR_IDS = [
  'quota', 'usage', 'dailyBuckets', 'featureUsage', 'billing', 'tokens', 'rawData',
] as const satisfies readonly AggregatorId[];

export interface StreamFileOptions {
  chunkSize?: number;
  progressResolution?: number;
  onProgress?: (progress: IngestionProgress) => void;
}

/** Each call owns a fresh worker and aggregates; the File is never read into memory here. */
export async function streamFile(
  file: File,
  aggregatorIds: readonly AggregatorId[],
  rowFilter?: RowFilter,
  options: StreamFileOptions = {},
): Promise<IngestionResult> {
  const request: IngestionRequest = {
    file,
    aggregatorIds,
    rowFilter,
    chunkSize: options.chunkSize,
    progressResolution: options.progressResolution,
  };

  if (typeof Worker === 'undefined') {
    const { runFileIngestion } = await import('./runFileIngestion');
    return new Promise((resolve, reject) => {
      runFileIngestion(request, response => {
        if (response.type === 'progress') options.onProgress?.(response.progress);
        else if (response.type === 'complete') resolve(response.result);
        else reject(new Error(response.error));
      });
    });
  }

  const { createIngestionWorker } = await import('./createIngestionWorker');
  const worker = createIngestionWorker();
  return new Promise((resolve, reject) => {
    const fail = (message: string) => {
      worker.terminate();
      reject(new Error(message));
    };
    worker.onmessage = (event: MessageEvent<IngestionResponse>) => {
      const response = event.data;
      if (response.type === 'progress') {
        options.onProgress?.(response.progress);
      } else if (response.type === 'complete') {
        worker.terminate();
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
    try {
      worker.postMessage(request);
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed to send file to ingestion worker');
    }
  });
}
