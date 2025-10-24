/**
 * Streaming CSV ingestion orchestrator.
 * Coordinates aggregators during PapaParse streaming, ensuring single-pass O(R) processing.
 */

import Papa from 'papaparse';
import { PRICING } from '@/constants/pricing';
import { normalizeRow } from './normalizeRow';
import {
  Aggregator,
  AggregatorContext,
  IngestOptions,
  IngestionResult,
  IngestionProgress
} from './types';

/**
 * Stream and process a CSV file using composable aggregators.
 * Each row is normalized once and dispatched to all registered aggregators.
 */
export function ingestStream(
  file: File,
  aggregators: Aggregator[],
  opts: IngestOptions
): void {
  const {
    chunkSize = 1024 * 1024,
    progressResolution = 1000,
    onProgress,
    onComplete,
    onError
  } = opts;
  
  // Create shared context
  const ctx: AggregatorContext = {
    pricing: PRICING
  };
  
  // Initialize aggregators
  for (const aggregator of aggregators) {
    aggregator.init?.(ctx);
  }
  
  let rowsProcessed = 0;
  const warnings: string[] = [];
  const t0 = performance.now();
  
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    chunkSize,
    chunk: ({ data, errors }, parser) => {
      // Handle parse errors
      if (errors.length > 0) {
        parser.abort();
        onError?.(`CSV parsing error: ${errors[0].message}`);
        return;
      }
      
      // Process each row in chunk
      for (const rawRow of data as Record<string, unknown>[]) {
        const normalized = normalizeRow(rawRow, warnings);
        if (!normalized) continue;
        
        // Dispatch to all aggregators
        for (const aggregator of aggregators) {
          try {
            aggregator.onRow(normalized, ctx);
          } catch (err) {
            warnings.push(`Aggregator ${aggregator.id} error: ${err}`);
          }
        }
        
        rowsProcessed++;
        
        // Progress callback
        if (progressResolution > 0 && rowsProcessed % progressResolution === 0) {
          const progress: IngestionProgress = {
            rowsProcessed
          };
          onProgress?.(progress);
        }
      }
      
      // Chunk end hook
      for (const aggregator of aggregators) {
        aggregator.onChunkEnd?.();
      }
    },
    complete: () => {
      // Finalize all aggregators
      const outputs: Record<string, unknown> = {};
      for (const aggregator of aggregators) {
        try {
          outputs[aggregator.id] = aggregator.finalize(ctx);
        } catch (err) {
          warnings.push(`Aggregator ${aggregator.id} finalize error: ${err}`);
          outputs[aggregator.id] = null;
        }
      }
      
      const result: IngestionResult = {
        outputs,
        rowsProcessed,
        warnings,
        durationMs: performance.now() - t0
      };
      
      onComplete(result);
    },
    error: (error) => {
      onError?.(`File reading error: ${error.message}`);
    }
  });
}
