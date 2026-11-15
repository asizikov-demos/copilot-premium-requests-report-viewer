import type { AggregatorId } from './registry';
import type { IngestionProgress, IngestionResult, RowFilter } from './types';

export interface IngestionRequest {
  file: File;
  aggregatorIds: readonly AggregatorId[];
  rowFilter?: RowFilter;
  chunkSize?: number;
  progressResolution?: number;
}

export type IngestionResponse =
  | { type: 'progress'; progress: IngestionProgress }
  | { type: 'complete'; result: IngestionResult }
  | { type: 'error'; error: string };
