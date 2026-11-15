import { readFileSync } from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { isMap, isSet } from 'node:util/types';

import Papa from 'papaparse';

import type { CSVData } from '@/types/csv';
import { normalizeRow } from '@/utils/ingestion/normalizeRow';
import type { NormalizedRow } from '@/utils/ingestion/types';
import { REPORT_AGGREGATOR_IDS, streamFile } from '@/utils/ingestion/streamFile';

import { buildTokenArtifactsFromRows, buildUsageArtifactsFromRows } from '../helpers/normalizedArtifacts';
import { createStreamingFile, MockFileReader } from '../helpers/streamingFile';

function canonical(value: unknown): unknown {
  if (isMap(value)) return [...value].map(([key, item]) => [key, canonical(item)]);
  if (isSet(value)) return [...value].map(canonical);
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

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

  it('preserves every semantic artifact from the original single-month sample through streaming ingestion', async () => {
    const originalReader = globalThis.FileReader;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
    try {
      const csv = readFileSync(path.join(process.cwd(), 'public/data/ai-credits-example.csv'), 'utf8');
      const result = await streamFile(createStreamingFile(csv), REPORT_AGGREGATOR_IDS);
      expect(result.rowsProcessed).toBe(1693);
      expect(result.warnings).toEqual([]);
      // Captured from main before removing partition/provenance fields.
      expect(createHash('sha256').update(JSON.stringify(canonical(result.outputs))).digest('hex'))
        .toBe('8626084213ec5418eeebd9393d460706e816f2c23d8e01a6efe305256e69fab9');
    } finally {
      globalThis.FileReader = originalReader;
    }
  });
});
