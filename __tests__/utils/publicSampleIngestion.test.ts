import { readFileSync } from 'fs';
import path from 'path';

import Papa from 'papaparse';

import type { CSVData } from '@/types/csv';
import { normalizeRow } from '@/utils/ingestion/normalizeRow';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { buildTokenArtifactsFromRows, buildUsageArtifactsFromRows } from '../helpers/normalizedArtifacts';

describe('checked-in AI-credit sample', () => {
  it('parses and ingests every row with valid AI credits and token counts', () => {
    const csv = readFileSync(
      path.join(process.cwd(), 'public/data/ai-credits-example.csv'),
      'utf8'
    );
    const parsed = Papa.parse<CSVData>(csv, { header: true, skipEmptyLines: true });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.data).toHaveLength(1693);

    const warnings: string[] = [];
    const normalized = parsed.data.map(row => normalizeRow(row, warnings));
    const normalizedRows = normalized.filter((row): row is NormalizedRow => row !== null);
    expect(warnings).toHaveLength(0);
    expect(normalizedRows).toHaveLength(1693);
    expect(normalizedRows.every(row =>
      row.usageUnit === 'ai_credit' &&
      Number.isFinite(row.quantity) &&
      row.quantity >= 0 &&
      row.day === row.date.slice(0, 10)
    )).toBe(true);

    const usage = buildUsageArtifactsFromRows(normalizedRows);
    expect(Object.values(usage.modelTotals).reduce((sum, credits) => sum + credits, 0)).toBeGreaterThan(0);

    const tokens = buildTokenArtifactsFromRows(normalizedRows);
    const fields = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const;
    expect(tokens.hasAnyTokenData).toBe(true);
    expect(tokens.totals.rowCount).toBe(1693);
    expect(fields.some(field => tokens.totals.reportedRows[field] > 0)).toBe(true);
    expect(normalizedRows.every(row => fields.every(field => {
      const value = row[field];
      return value === undefined || (Number.isSafeInteger(value) && value >= 0);
    }))).toBe(true);
  });
});
