import { ingestStream } from './orchestrator';
import { createAggregators } from './registry';
import type { IngestionRequest, IngestionResponse } from './workerProtocol';

export function runFileIngestion(
  request: IngestionRequest,
  respond: (response: IngestionResponse) => void,
  signal?: AbortSignal,
): void {
  try {
    ingestStream(request.file, createAggregators(request.aggregatorIds), {
      signal,
      chunkSize: request.chunkSize,
      progressResolution: request.progressResolution,
      rowFilter: request.rowFilter,
      onProgress: progress => respond({ type: 'progress', progress }),
      onComplete: result => {
        try {
          respond({ type: 'complete', result });
        } catch (error) {
          respond({
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to transfer ingestion results',
          });
        }
      },
      onError: error => respond({ type: 'error', error }),
    });
  } catch (error) {
    respond({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to process CSV file',
    });
  }
}
