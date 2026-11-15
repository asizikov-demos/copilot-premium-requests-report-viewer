import { runFileIngestion } from '@/utils/ingestion/runFileIngestion';
import { streamFile } from '@/utils/ingestion/streamFile';
import type { IngestionResponse } from '@/utils/ingestion/workerProtocol';
import type { UsageArtifacts } from '@/utils/ingestion/types';

import { createStreamingFile, MockFileReader } from '../helpers/streamingFile';

const header = 'date,username,sku,model,quantity';
const row = (date: string, quantity = '1') =>
  `${date},test-user-one,copilot_ai_credit,test-model-one,${quantity}`;

describe('single-month report ingestion', () => {
  const originalFileReader = globalThis.FileReader;

  beforeEach(() => {
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  });

  afterEach(() => {
    globalThis.FileReader = originalFileReader;
  });

  it.each([
    ['2026-06-30T23:59:59Z', '2026-07-01T00:00:00Z'],
    ['2026-12-31', '2027-01-01'],
    ['6/30/26', '7/1/26'],
    ['2026-06-30', '7/1/26'],
  ])('rejects a second month across chunks: %s / %s', async (first, second) => {
    const file = createStreamingFile([header, row(first), row(second), ...Array(100).fill(row(second))].join('\n'));
    const read = jest.spyOn(MockFileReader.prototype, 'readAsText');
    const responses: IngestionResponse[] = [];

    runFileIngestion({ file, aggregatorIds: ['usage'], chunkSize: 96 }, response => responses.push(response));

    expect(responses.filter(response => response.type === 'error')).toEqual([{
      type: 'error',
      error: expect.stringMatching(/spans multiple months.*single calendar month \(UTC\)/),
    }]);
    expect(responses.some(response => response.type === 'complete')).toBe(false);
    expect(read.mock.calls.length * 96).toBeLessThan(file.size);
    read.mockRestore();
  });

  it('validates the whole report before skipping malformed quantities', async () => {
    const file = createStreamingFile([header, row('2026-06-30'), row('2026-07-01', 'invalid')].join('\n'));
    await expect(streamFile(file, ['usage']))
      .rejects.toThrow('multiple months (2026-06 and 2026-07)');
  });

  it('checks date columns even on transitional legacy rows', async () => {
    const file = createStreamingFile([
      header, row('2026-06-30'),
      '2026-07-01,test-user-two,copilot_premium_request,test-model-one,1',
    ].join('\n'));
    await expect(streamFile(file, ['usage'])).rejects.toThrow('multiple months (2026-06 and 2026-07)');
  });

  it('preserves the source calendar month without converting timestamp offsets', async () => {
    const file = createStreamingFile([
      header,
      row('2026-06-01T00:30:00+14:00'),
      row('2026-06-30T23:30:00-12:00', '2'),
    ].join('\n'));
    const result = await streamFile(file, ['usage']);
    expect(result.rowsProcessed).toBe(2);
    expect((result.outputs.usage as UsageArtifacts).users[0].totalCredits).toBe(3);
    expect(result.warnings).toEqual([]);
  });
});
