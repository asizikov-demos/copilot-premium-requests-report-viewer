import { PRICING } from '@/constants/pricing';
import {
  BillingAggregator,
  buildNormalizedRowFromProcessedData,
  buildProcessedDataFromRows,
  buildTokenArtifactsFromProcessedData,
  filterTokenArtifactsByMonths,
  normalizeRow,
  TokenAggregator,
} from '@/utils/ingestion';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

const rawRow = {
  date: '2026-06-30T23:59:59Z',
  username: 'test-user-one',
  model: 'test-model-one',
  quantity: '2',
  unit_type: 'ai-credits',
  gross_amount: '1',
};

describe('token normalization', () => {
  it('parses canonical fields and preserves zeros through both row adapters', () => {
    const warnings: string[] = [];
    const row = normalizeRow({
      ...rawRow, input: ' 100 ', output: '20', cache_read: '0', cache_write: '5',
    }, warnings);
    expect(row).not.toBeNull();
    if (!row) throw new Error('Expected a normalized row');

    const expected = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 5 };
    expect(row).toMatchObject(expected);
    const processed = buildProcessedDataFromRows([row]);
    expect(processed[0]).toMatchObject({ ...expected, dateKey: '2026-06-30', monthKey: '2026-06' });
    expect(buildNormalizedRowFromProcessedData(processed[0])).toMatchObject(expected);
    expect(buildTokenArtifactsFromProcessedData(processed).totals).toMatchObject(expected);
    expect(warnings).toEqual([]);
  });

  it('supports every legacy alias and blank canonical fields', () => {
    expect(normalizeRow({
      ...rawRow,
      input: ' ',
      total_input_tokens: '10',
      total_output_tokens: '20',
      total_cache_read_tokens: '30',
      total_cache_creation_tokens: '40',
    }, [])).toMatchObject({ inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 });
  });

  it('does not double-count duplicate aliases and warns on conflicts, including zero', () => {
    const warnings: string[] = [];
    const row = normalizeRow({
      ...rawRow, input: '0', total_input_tokens: '10', output: '20', total_output_tokens: '20',
    }, warnings);
    expect(row).toMatchObject({ inputTokens: 0, outputTokens: 20 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Conflicting token counts in input and total_input_tokens');
  });

  it.each([undefined, null, '', ' \t '])('keeps missing/blank counts absent: %p', value => {
    const warnings: string[] = [];
    const row = normalizeRow({ ...rawRow, input: value }, warnings);
    expect(row).not.toBeNull();
    expect(row).not.toHaveProperty('inputTokens');
    expect(warnings).toEqual([]);
  });

  it.each(['invalid', '12tokens', '-1', '1.5', 'Infinity', 'NaN', '1e3', '0x10', '9007199254740992', -1, 1.5, Infinity, NaN, true, {}])(
    'warns on invalid token counts without dropping billing data: %p',
    value => {
      const warnings: string[] = [];
      const row = normalizeRow({ ...rawRow, input: value, output: '5' }, warnings);
      expect(row).toMatchObject({ outputTokens: 5, billingQuantity: 2, aicQuantity: 2, grossAmount: 1 });
      expect(row).not.toHaveProperty('inputTokens');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Invalid token count in input');
    }
  );

  it('does not conceal an invalid canonical count with a valid alias', () => {
    const warnings: string[] = [];
    const row = normalizeRow({ ...rawRow, input: 'invalid', total_input_tokens: '10' }, warnings);
    expect(row).not.toHaveProperty('inputTokens');
    expect(warnings).toHaveLength(1);
  });

  it('validates aliases even when a canonical value takes precedence', () => {
    const warnings: string[] = [];
    expect(normalizeRow({ ...rawRow, input: 0, total_input_tokens: '-1' }, warnings))
      .toMatchObject({ inputTokens: 0 });
    expect(warnings[0]).toContain('Invalid token count in total_input_tokens');
  });

  it('does not change normalized billing, request, quota, or organizational data', () => {
    const billingRow = { ...rawRow, organization: 'test-org-one', cost_center_name: 'test-cost-center-one' };
    const withoutTokens = normalizeRow(billingRow, []);
    const withTokens = normalizeRow({ ...billingRow, input: '100' }, []);
    expect(withTokens).toEqual({ ...withoutTokens, inputTokens: 100 });
    if (!withoutTokens || !withTokens) throw new Error('Expected valid rows');

    const context = { pricing: PRICING };
    const original = new BillingAggregator();
    original.onRow(withoutTokens, context);
    const enriched = new BillingAggregator();
    enriched.onRow(withTokens, context);
    expect(enriched.finalize(context)).toEqual(original.finalize(context));
  });
});

describe('token artifacts', () => {
  const rows = [
    makeNormalizedRow({ day: '2026-07-01', model: 'test-model-two', inputTokens: 50, outputTokens: 5 }),
    makeNormalizedRow({ day: '2026-06-30', model: 'test-model-one', inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 4 }),
    makeNormalizedRow({ day: '2026-06-30', user: 'test-user-two', model: 'test-model-one', inputTokens: 0 }),
    makeNormalizedRow({ day: '2026-06-30', model: 'test-model-one' }),
    makeNormalizedRow({ day: '2026-06-30', user: '', model: 'test-model-one', inputTokens: 10, isNonCopilotUsage: true, usageBucket: 'unattributed_ai_credit' }),
    makeNormalizedRow({ day: '2026-06-30', user: '', model: 'test-model-two', inputTokens: 3, isNonCopilotUsage: true, usageBucket: 'non_copilot_code_review' }),
  ];

  function aggregate() {
    const aggregator = new TokenAggregator();
    rows.forEach(row => aggregator.onRow(row));
    return aggregator.finalize();
  }

  it('retains category totals and per-field coverage at every dimension', () => {
    const artifacts = aggregate();
    expect(artifacts.hasAnyTokenData).toBe(true);
    expect(artifacts.totals).toEqual({
      inputTokens: 163, outputTokens: 25, cacheReadTokens: 0, cacheWriteTokens: 4,
      rowCount: 6,
      reportedRows: { inputTokens: 5, outputTokens: 2, cacheReadTokens: 1, cacheWriteTokens: 1 },
    });
    expect(artifacts.byModel.get('test-model-one')).toMatchObject({ inputTokens: 110, rowCount: 4 });
    expect(artifacts.byUser.get('test-user-one')).toMatchObject({ inputTokens: 150, rowCount: 3 });
    expect(artifacts.byUser.get('test-user-two')).toMatchObject({ inputTokens: 0, rowCount: 1 });
    expect([...artifacts.byUser.keys()]).toEqual(['test-user-one', 'test-user-two']);
    expect(artifacts.specialBuckets.get('unattributed_ai_credit')?.inputTokens).toBe(10);
    expect(artifacts.specialBuckets.get('non_copilot_code_review')?.inputTokens).toBe(3);
    expect([...artifacts.byDay.keys()]).toEqual(['2026-06-30', '2026-07-01']);
    expect(artifacts.byDay.get('2026-06-30')?.byModel.get('test-model-one')?.inputTokens).toBe(110);
    expect(artifacts.byDay.get('2026-06-30')?.byUser.get('test-user-one')?.inputTokens).toBe(100);
  });

  it('filters every dimension by UTC month without requiring raw rows or mutating totals', () => {
    const artifacts = aggregate();
    const june = filterTokenArtifactsByMonths(artifacts, ['2026-06', '2026-06']);
    expect(june.totals).toMatchObject({ inputTokens: 113, outputTokens: 20, rowCount: 5 });
    expect(june.totals.reportedRows.inputTokens).toBe(4);
    expect(june.byUser.get('test-user-one')?.inputTokens).toBe(100);
    expect(june.byModel.get('test-model-two')?.inputTokens).toBe(3);
    expect(june.specialBuckets.get('unattributed_ai_credit')?.inputTokens).toBe(10);
    expect([...june.byDay.keys()]).toEqual(['2026-06-30']);
    expect(artifacts).toEqual(aggregate());
    expect(filterTokenArtifactsByMonths(artifacts, [])).toBe(artifacts);
    expect(filterTokenArtifactsByMonths(artifacts, ['2026-06', '2026-07'])).toEqual(artifacts);
    expect(filterTokenArtifactsByMonths(artifacts, ['2026-08'])).toMatchObject({
      hasAnyTokenData: false, totals: { rowCount: 0 }, byModel: new Map(), byDay: new Map(),
    });
  });

  it('distinguishes all-zero counts from legacy reports with no counts', () => {
    const aggregator = new TokenAggregator();
    aggregator.onRow(makeNormalizedRow());
    expect(aggregator.finalize().hasAnyTokenData).toBe(false);
    expect(aggregator.finalize().totals.inputTokens).toBeUndefined();
    aggregator.onRow(makeNormalizedRow({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }));
    expect(aggregator.finalize().hasAnyTokenData).toBe(true);
    expect(aggregator.finalize().totals).toMatchObject({
      inputTokens: 0, rowCount: 2, reportedRows: { inputTokens: 1 },
    });
    aggregator.init();
    expect(aggregator.finalize()).toEqual(new TokenAggregator().finalize());
  });

  it('reconstructs identical artifacts through the processed-data bridge', () => {
    const aggregator = new TokenAggregator();
    const datedRows = rows.map(row => ({ ...row, date: row.day }));
    datedRows.forEach(row => aggregator.onRow(row));
    expect(buildTokenArtifactsFromProcessedData(buildProcessedDataFromRows(datedRows)))
      .toEqual(aggregator.finalize());
  });

  it('rejects invalid normalized counts supplied outside CSV ingestion', () => {
    const aggregator = new TokenAggregator();
    expect(() => aggregator.onRow(makeNormalizedRow({ inputTokens: -1 })))
      .toThrow('Invalid normalized token count');
    expect(() => aggregator.finalize()).toThrow('Invalid normalized token count');
  });

  it('accepts exact safe totals but fails explicitly rather than rounding an overflowing sum', () => {
    const aggregator = new TokenAggregator();
    aggregator.onRow(makeNormalizedRow({ inputTokens: Number.MAX_SAFE_INTEGER }));
    aggregator.onRow(makeNormalizedRow({ inputTokens: 0 }));
    expect(aggregator.finalize().totals.inputTokens).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => aggregator.onRow(makeNormalizedRow({ inputTokens: 1 })))
      .toThrow('Token total exceeds the safe integer range in inputTokens');
    expect(() => aggregator.finalize()).toThrow('Token total exceeds the safe integer range');
    aggregator.init();
    expect(aggregator.finalize().hasAnyTokenData).toBe(false);
  });
});
