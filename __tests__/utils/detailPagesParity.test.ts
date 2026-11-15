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

describe.each(['__tests__/fixtures/detail-usage.csv', 'public/data/ai-credits-example.csv'])(
  'single-pass detail parity for %s', filename => {
    it('matches every user and billing-group re-stream, with a stable semantic golden', async () => {
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
      expect(createHash('sha256').update(JSON.stringify(canonical(views))).digest('hex')).toMatchSnapshot();
    });
  },
);
