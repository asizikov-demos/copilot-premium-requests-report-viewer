import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMap, isSet } from 'node:util/types';

import Papa from 'papaparse';

import type { CSVData } from '@/types/csv';
import { selectDetailArtifacts, type CompactDetailArtifacts } from '@/utils/ingestion/DetailAggregator';
import { DetailPagesAggregator, selectBillingGroupDetails, selectUserDetails } from '@/utils/ingestion/DetailPagesAggregator';
import { streamFile } from '@/utils/ingestion/streamFile';
import type { TokenArtifacts } from '@/utils/ingestion/types';

import { aggregateRows } from '../helpers/aggregateRows';
import { normalizeRows } from '../helpers/normalizeRows';
import { createStreamingFile, MockFileReader } from '../helpers/streamingFile';

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
      const artifacts = aggregateRows(new DetailPagesAggregator(), rows);
      const views: unknown[] = [];
      const originalReader = globalThis.FileReader;
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
      try {
        for (const user of artifacts.users.keys()) {
          const old = await streamFile(createStreamingFile(csv), ['details', 'tokens'], { user });
          const current = selectUserDetails(artifacts, user);
          expect(old.warnings).toEqual([]);
          expect(current.details).toEqual(selectDetailArtifacts(old.outputs.details as CompactDetailArtifacts));
          expect(current.tokens).toEqual(old.outputs.tokens as TokenArtifacts);
          views.push([user, current]);
        }
        for (const kind of ['organization', 'costCenter'] as const) {
          const groups = kind === 'organization' ? artifacts.organizations : artifacts.costCenters;
          for (const name of groups.keys()) {
            const old = await streamFile(createStreamingFile(csv), ['details'], { [kind]: name });
            const current = selectBillingGroupDetails(artifacts, kind, name);
            expect(old.warnings).toEqual([]);
            expect(current.details).toEqual(selectDetailArtifacts(old.outputs.details as CompactDetailArtifacts));
            views.push([kind, name, current]);
          }
        }
      } finally {
        globalThis.FileReader = originalReader;
      }
      expect(createHash('sha256').update(JSON.stringify(canonical(views))).digest('hex')).toMatchSnapshot();
    });
  },
);
