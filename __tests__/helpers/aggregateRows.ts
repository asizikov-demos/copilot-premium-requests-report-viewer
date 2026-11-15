import { PRICING } from '@/constants/pricing';
import { createAggregators } from '@/utils/ingestion/registry';
import { REPORT_AGGREGATOR_IDS } from '@/utils/ingestion/streamFile';
import type { Aggregator, IngestionResult, NormalizedRow } from '@/utils/ingestion/types';

export function aggregateRows<T>(aggregator: Aggregator<T>, rows: readonly NormalizedRow[]): T {
  const context = { pricing: PRICING };
  aggregator.init?.(context);
  for (const row of rows) aggregator.onRow(row, context);
  return aggregator.finalize(context);
}

export function ingestRows(rows: readonly NormalizedRow[]): IngestionResult {
  return {
    outputs: Object.fromEntries(createAggregators(REPORT_AGGREGATOR_IDS)
      .map(aggregator => [aggregator.id, aggregateRows(aggregator, rows)])),
    rowsProcessed: rows.length, durationMs: 0, warnings: [],
  };
}
