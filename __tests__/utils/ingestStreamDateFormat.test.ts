import { ingestStream } from '@/utils/ingestion/orchestrator';
import type { Aggregator, IngestionResult, NormalizedRow } from '@/utils/ingestion/types';

interface FileLikeChunk {
  content: string;
}

class MockFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: (() => void) | null = null;
  error: Error | null = null;

  readAsText(chunk: FileLikeChunk): void {
    this.onload?.({ target: { result: chunk.content } });
  }
}

function createStreamingCsvFile(csv: string): File {
  const file = new File([csv], 'test-usage.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'size', { value: csv.length });
  Object.defineProperty(file, 'slice', {
    value: (start = 0, end = csv.length): FileLikeChunk => ({
      content: csv.slice(start, end),
    }),
  });
  return file;
}

function createCapturingAggregator(): Aggregator<NormalizedRow[]> {
  const rows: NormalizedRow[] = [];

  return {
    id: 'capturedRows',
    onRow: (row) => {
      rows.push(row);
    },
    finalize: () => rows,
  };
}

function ingestCsv(csv: string): Promise<IngestionResult> {
  const originalFileReader = globalThis.FileReader;
  globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

  return new Promise((resolve, reject) => {
    ingestStream(createStreamingCsvFile(csv), [createCapturingAggregator()], {
      onComplete: (result) => {
        globalThis.FileReader = originalFileReader;
        resolve(result);
      },
      onError: (error) => {
        globalThis.FileReader = originalFileReader;
        reject(new Error(error));
      },
    });
  });
}

describe('ingestStream date format normalization', () => {
  it('normalizes US slash dates through the streaming ingestion path', async () => {
    const csv = [
      'date,username,product,sku,model,quantity,exceeds_quota,total_monthly_quota,organization,cost_center_name',
      '5/29/26,test-user-one,copilot,copilot_premium_request,Claude Sonnet 4,2,FALSE,1000,test-org-one,test-cost-center-one',
      '6/1/26,test-user-two,copilot,copilot_premium_request,Code Review model,3,TRUE,300,test-org-two,test-cost-center-two',
    ].join('\n');

    const result = await ingestCsv(csv);
    const rows = result.outputs.capturedRows as NormalizedRow[];

    expect(result.rowsProcessed).toBe(2);
    expect(result.warnings).toEqual([]);
    expect(rows.map(row => row.date)).toEqual(['2026-05-29', '2026-06-01']);
    expect(rows.map(row => row.day)).toEqual(['2026-05-29', '2026-06-01']);
  });

  it('warns and skips rows when the first streamed date format is unrecognized', async () => {
    const csv = [
      'date,username,product,sku,model,quantity,exceeds_quota,total_monthly_quota,organization,cost_center_name',
      'May 29 2026,test-user-one,copilot,copilot_premium_request,Claude Sonnet 4,2,FALSE,1000,test-org-one,test-cost-center-one',
      '2026-05-30,test-user-two,copilot,copilot_premium_request,Claude Sonnet 4,3,FALSE,1000,test-org-two,test-cost-center-two',
    ].join('\n');

    const result = await ingestCsv(csv);
    const rows = result.outputs.capturedRows as NormalizedRow[];

    expect(result.rowsProcessed).toBe(0);
    expect(rows).toEqual([]);
    expect(result.warnings).toContain('Unrecognized date format in CSV: May 29 2026');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Unrecognized date format for user=test-user-one date=May 29 2026',
        'Unrecognized date format for user=test-user-two date=2026-05-30',
      ])
    );
  });

  it('continues to normalize ISO dates through ingestStream', async () => {
    const csv = [
      'date,username,product,sku,model,quantity,exceeds_quota,total_monthly_quota,organization,cost_center_name',
      '2026-05-29,test-user-one,copilot,copilot_premium_request,Claude Sonnet 4,2,FALSE,1000,test-org-one,test-cost-center-one',
    ].join('\n');

    const result = await ingestCsv(csv);
    const rows = result.outputs.capturedRows as NormalizedRow[];

    expect(result.rowsProcessed).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(rows[0]).toMatchObject({
      date: '2026-05-29',
      day: '2026-05-29',
      user: 'test-user-one',
    });
  });
});
