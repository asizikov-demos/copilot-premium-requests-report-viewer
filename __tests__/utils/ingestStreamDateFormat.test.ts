import { PRICING } from '@/constants/pricing';
import { ingestStream } from '@/utils/ingestion/orchestrator';
import type { Aggregator, IngestionResult, NormalizedRow } from '@/utils/ingestion/types';
import { TokenAggregator } from '@/utils/ingestion/TokenAggregator';
import type { TokenArtifacts } from '@/utils/ingestion/types';

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

function ingestCsv(
  csv: string,
  aggregators: Aggregator[] = [createCapturingAggregator()],
  chunkSize?: number
): Promise<IngestionResult> {
  const originalFileReader = globalThis.FileReader;
  globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

  return new Promise((resolve, reject) => {
    ingestStream(createStreamingCsvFile(csv), aggregators, {
      chunkSize,
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
  it.each([
    {
      name: 'request unit',
      sku: 'copilot_ai_credit',
      unitType: 'requests',
    },
    {
      name: 'premium-request SKU',
      sku: 'copilot_premium_request',
      unitType: 'ai-credits',
    },
  ])('rejects a $name import exactly once without completing', ({ sku, unitType }) => {
    const csv = [
      'date,username,sku,unit_type,model,quantity',
      `2026-07-01,test-user-one,${sku},${unitType},test-model-one,2`,
    ].join('\n');
    const onComplete = jest.fn();
    const onError = jest.fn();
    const originalFileReader = globalThis.FileReader;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    try {
      ingestStream(createStreamingCsvFile(csv), [createCapturingAggregator()], {
        onComplete,
        onError,
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('unsupported premium-request rows'));
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });

  it('accepts an AI-credit SKU without unit_type or optional billing columns', async () => {
    const csv = [
      'date,username,sku,model,quantity,total_monthly_quota',
      `2026-07-01,test-user-one,copilot_ai_credit,test-model-one,2.5,${PRICING.BUSINESS_AI_CREDIT_QUOTA}`,
    ].join('\n');

    const result = await ingestCsv(csv);
    expect(result.rowsProcessed).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(result.outputs.capturedRows).toEqual([
      expect.objectContaining({
        user: 'test-user-one',
        usageUnit: 'ai_credit',
        quantity: 2.5,
        quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
        grossAmount: undefined,
        discountAmount: undefined,
        netAmount: undefined,
      }),
    ]);
  });

  it('skips legacy request rows in a mixed export while completing with only AI credits', async () => {
    const csv = [
      'date,username,sku,unit_type,model,quantity,net_amount',
      '2026-06-30,test-user-one,copilot_ai_credit,ai-credits,test-model-one,2.5,0.025',
      '2026-06-30,test-user-one,copilot_ai_credit,requests,test-model-one,100,1',
      '2026-07-01,test-user-two,copilot_ai_credit,ai-credits,test-model-two,3.5,',
      '2026-07-01,test-user-two,copilot_premium_request,ai-credits,test-model-two,200,2',
    ].join('\n');

    const result = await ingestCsv(csv, [createCapturingAggregator()], 96);
    const rows = result.outputs.capturedRows as NormalizedRow[];
    expect(result.rowsProcessed).toBe(2);
    expect(result.warnings).toEqual([]);
    expect(rows.map(row => ({
      user: row.user,
      quantity: row.quantity,
      netAmount: row.netAmount,
    }))).toEqual([
      { user: 'test-user-one', quantity: 2.5, netAmount: 0.025 },
      { user: 'test-user-two', quantity: 3.5, netAmount: undefined },
    ]);
  });

  it('reports token overflow without exposing partial token totals or losing other artifacts', async () => {
    const csv = [
      'date,username,unit_type,model,quantity,input',
      `2026-06-30,test-user-one,ai-credits,test-model-one,1,${Number.MAX_SAFE_INTEGER}`,
      '2026-06-30,test-user-one,ai-credits,test-model-one,1,1',
      ...Array.from({ length: 1000 }, () => '2026-06-30,test-user-one,ai-credits,test-model-one,1,1'),
    ].join('\n');
    const result = await ingestCsv(csv, [new TokenAggregator(), createCapturingAggregator()]);
    expect(result.rowsProcessed).toBe(1002);
    expect(result.outputs.tokens).toBeNull();
    expect(result.outputs.capturedRows).toHaveLength(1002);
    expect(result.warnings).toEqual([
      'Aggregator tokens error: Error: Token total exceeds the safe integer range in inputTokens',
      'Aggregator tokens finalize error: Error: Token total exceeds the safe integer range in inputTokens',
    ]);
  });

  it('streams optional tokens across chunks and UTC month boundaries without dropping invalid-token rows', async () => {
    const csv = [
      'date,username,model,quantity,unit_type,input,output,cache_read,cache_write,total_input_tokens',
      '2026-06-30T23:59:59Z,test-user-one,test-model-one,1,ai-credits,0,2,3,4,10',
      '2026-07-01T00:00:00Z,test-user-one,test-model-one,1,ai-credits,invalid,0,,,',
      '2026-07-02T00:00:00Z,test-user-two,test-model-two,1,ai-credits,,,,,5',
    ].join('\n');
    const result = await ingestCsv(csv, [new TokenAggregator(), createCapturingAggregator()], 128);
    expect(result.rowsProcessed).toBe(3);
    const tokens = result.outputs.tokens as TokenArtifacts;
    expect(tokens.totals).toMatchObject({
      inputTokens: 5, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4,
      rowCount: 3, reportedRows: { inputTokens: 2, outputTokens: 2 },
    });
    expect([...tokens.byDay.keys()]).toEqual(['2026-06-30', '2026-07-01', '2026-07-02']);
    expect(result.outputs.capturedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ day: '2026-07-01', outputTokens: 0, aicQuantity: 1 }),
    ]));
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('Conflicting token counts');
    expect(result.warnings[1]).toContain('Invalid token count');
  });

  it('normalizes US slash dates through the streaming ingestion path', async () => {
    const csv = [
      'date,username,product,sku,model,quantity,total_monthly_quota,organization,cost_center_name',
      `5/29/26,test-user-one,copilot,copilot_ai_credit,Claude Sonnet 4,2,${PRICING.ENTERPRISE_AI_CREDIT_QUOTA},test-org-one,test-cost-center-one`,
      `6/1/26,test-user-two,copilot,copilot_ai_credit,Code Review model,3,${PRICING.BUSINESS_AI_CREDIT_QUOTA},test-org-two,test-cost-center-two`,
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
      'date,username,product,sku,model,quantity,total_monthly_quota,organization,cost_center_name',
      `May 29 2026,test-user-one,copilot,copilot_ai_credit,Claude Sonnet 4,2,${PRICING.ENTERPRISE_AI_CREDIT_QUOTA},test-org-one,test-cost-center-one`,
      `2026-05-30,test-user-two,copilot,copilot_ai_credit,Claude Sonnet 4,3,${PRICING.ENTERPRISE_AI_CREDIT_QUOTA},test-org-two,test-cost-center-two`,
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
      'date,username,product,sku,model,quantity,total_monthly_quota,organization,cost_center_name',
      `2026-05-29,test-user-one,copilot,copilot_ai_credit,Claude Sonnet 4,2,${PRICING.ENTERPRISE_AI_CREDIT_QUOTA},test-org-one,test-cost-center-one`,
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
