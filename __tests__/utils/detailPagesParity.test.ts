import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMap, isSet } from 'node:util/types';

import Papa from 'papaparse';

import type { CSVData } from '@/types/csv';
import { DetailPagesAggregator, selectBillingGroupDetails, selectUserDetails } from '@/utils/ingestion/DetailPagesAggregator';
import { streamFile } from '@/utils/ingestion/streamFile';

import { aggregateRows } from '../helpers/aggregateRows';
import { normalizeRows } from '../helpers/normalizeRows';
import { createStreamingFile, MockFileReader } from '../helpers/streamingFile';
import type { DetailPagesArtifacts } from '@/utils/ingestion/DetailPagesAggregator';

function canonical(value: unknown): unknown {
  if (isMap(value)) return [...value].sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([key, item]) => [key, canonical(item)]);
  if (isSet(value)) return [...value].sort().map(canonical);
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

describe.each([
  ['__tests__/fixtures/detail-usage.csv', '437b19c9e6169850744f861c79df36265d1cae2f5d5c15483bf3e5dfeb1125bb'],
  ['public/data/ai-credits-example.csv', 'ffef19b750248dac39ff330a6b7ab789d318b48624006573543257b6c3f0508e'],
])(
  'single-pass detail parity for %s', (filename, expectedHash) => {
    it('preserves every user and billing-group detail artifact from the re-stream baseline', async () => {
      const csv = readFileSync(path.join(process.cwd(), filename), 'utf8');
      const rows = normalizeRows(Papa.parse<CSVData>(csv, { header: true, skipEmptyLines: true }).data);
      const views: unknown[] = [];
      const originalReader = globalThis.FileReader;
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
      try {
        const result = await streamFile(createStreamingFile(csv), ['detailPages'], { chunkSize: 8192 });
        expect(result.rowsProcessed).toBe(rows.length);
        expect(result.warnings).toEqual([]);
        const artifacts = result.outputs.detailPages as DetailPagesArtifacts;
        expect(artifacts).toEqual(aggregateRows(new DetailPagesAggregator(), rows));
        for (const user of artifacts.users.keys()) {
          const current = selectUserDetails(artifacts, user);
          views.push([user, current]);
        }
        for (const kind of ['organization', 'costCenter'] as const) {
          const groups = kind === 'organization' ? artifacts.organizations : artifacts.costCenters;
          for (const name of groups.keys()) {
            const current = selectBillingGroupDetails(artifacts, kind, name);
            views.push([kind, name, current]);
          }
        }
      } finally {
        globalThis.FileReader = originalReader;
      }
      // Captured while all scopes were also checked against the filtered re-stream path.
      expect(createHash('sha256').update(JSON.stringify(canonical(views))).digest('hex')).toBe(expectedHash);
    });
  },
);
