import type { CSVData } from '@/types/csv';
import { normalizeRow, type NormalizedRow } from '@/utils/ingestion';

export function normalizeRows(rows: readonly (CSVData | Record<string, unknown>)[]): NormalizedRow[] {
  const warnings: string[] = [];
  return rows.map(row => normalizeRow(row, warnings))
    .filter((row): row is NormalizedRow => row !== null);
}
