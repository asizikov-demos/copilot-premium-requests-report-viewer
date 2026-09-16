import { PRICING } from '@/constants/pricing';
import { buildUserConsumption } from '@/utils/analytics/userConsumption';
import { buildProcessedDataFromRawRows } from '@/utils/ingestion/adapters';

const base = {
  date: '2026-06-30T23:59:59Z', username: 'test-user-one', model: 'test-model-one',
  quantity: '0', unit_type: 'ai-credits',
};

describe('user consumption metrics', () => {
  it('sums credits by model and respects filtered rows', () => {
    const rows = buildProcessedDataFromRawRows([
      { ...base, quantity: '10', input: '100' },
      { ...base, quantity: '20', model: 'test-model-two', input: '200' },
      { ...base, date: '2026-07-02', quantity: '30', input: '300' },
      { ...base, date: '2026-07-03', input: '0' },
    ]);
    const result = buildUserConsumption(rows);
    expect(result.credits).toEqual({ quantity: 60, rowCount: 4, reportedRows: 4 });
    expect(result.creditsByModel.get('test-model-one')?.quantity).toBe(40);
    expect(result.tokens?.totals.inputTokens).toBe(600);
    expect(buildUserConsumption(rows.filter(row => row.monthKey === '2026-07')).credits.quantity).toBe(30);
  });

  it('distinguishes missing credits from reported zeros', () => {
    const missing = buildUserConsumption(buildProcessedDataFromRawRows([
      { ...base, quantity: '10' },
      { ...base, date: '2026-07-01', unit_type: 'requests', quantity: '1' },
    ]));
    expect(missing.credits).toEqual({ quantity: 10, rowCount: 2, reportedRows: 1 });

    const zero = buildUserConsumption(buildProcessedDataFromRawRows([{ ...base, input: '0' }]));
    expect(zero.credits.quantity).toBe(0);
    expect(buildUserConsumption([]).credits.quantity).toBeUndefined();
  });

  it('uses existing AI Credit semantics alongside token-only activity', () => {
    const result = buildUserConsumption(buildProcessedDataFromRawRows([
      { ...base, aic_quantity: '5', unit_type: 'requests', aic_gross_amount: String(10 * PRICING.AI_CREDIT_USD_VALUE) },
      { ...base, date: '2026-07-01', cache_read: '50' },
    ]));
    expect(result.credits.quantity).toBe(10);
    expect(result.tokens?.totals.cacheReadTokens).toBe(50);
  });

  it('retains token coverage and disables tokens after an ingestion failure', () => {
    const rows = buildProcessedDataFromRawRows([{ ...base, input: '5' }, base]);
    expect(buildUserConsumption(rows).tokens?.totals).toMatchObject({
      inputTokens: 5, rowCount: 2, reportedRows: { inputTokens: 1 },
    });
    expect(buildUserConsumption(rows, false).tokens).toBeUndefined();
    expect(buildUserConsumption(rows, false).credits.quantity).toBe(0);
  });
});
