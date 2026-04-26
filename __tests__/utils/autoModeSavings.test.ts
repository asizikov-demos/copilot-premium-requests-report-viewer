import type { ProcessedData } from '@/types/csv';
import { aggregateAutoModeSavings, getAutoModeBaseModel } from '@/utils/autoModeSavings';

function createRow(overrides: Partial<ProcessedData>): ProcessedData {
  const timestamp = new Date('2026-04-01T00:00:00Z');

  return {
    timestamp,
    user: 'user-1',
    model: 'Auto: GPT-5.3-Codex',
    requestsUsed: 0.9,
    exceedsQuota: false,
    totalQuota: '300',
    quotaValue: 300,
    iso: timestamp.toISOString(),
    dateKey: '2026-04-01',
    monthKey: '2026-04',
    epoch: timestamp.getTime(),
    appliedCostPerQuantity: 0.04,
    grossAmount: 0.036,
    discountAmount: 0,
    netAmount: 0.036,
    ...overrides,
  };
}

describe('Auto Mode savings', () => {
  it('strips the Auto label from model names', () => {
    expect(getAutoModeBaseModel('Auto: GPT-5.3-Codex')).toBe('GPT-5.3-Codex');
    expect(getAutoModeBaseModel('auto: Claude Sonnet')).toBe('Claude Sonnet');
    expect(getAutoModeBaseModel('Claude Sonnet')).toBeNull();
  });

  it('aggregates Auto rows using undiscounted requests and savings', () => {
    const rows: ProcessedData[] = [
      createRow({ requestsUsed: 0.9, grossAmount: 0.036, netAmount: 0.036 }),
      createRow({ requestsUsed: 1.8, grossAmount: 0.072, netAmount: 0.072 }),
      createRow({ model: 'Claude Sonnet 4', requestsUsed: 5, grossAmount: 0.2, netAmount: 0.2 }),
    ];

    const [result] = aggregateAutoModeSavings(rows);

    expect(result.model).toBe('GPT-5.3-Codex');
    expect(result.requests).toBeCloseTo(3);
    expect(result.grossCost).toBeCloseTo(0.12);
    expect(result.savings).toBeCloseTo(0.012);
  });

  it('falls back to standard pricing when billing cost fields are absent', () => {
    const rows: ProcessedData[] = [
      createRow({
        requestsUsed: 0.9,
        appliedCostPerQuantity: undefined,
        grossAmount: undefined,
        netAmount: undefined,
      }),
    ];

    const [result] = aggregateAutoModeSavings(rows);

    expect(result.model).toBe('GPT-5.3-Codex');
    expect(result.requests).toBeCloseTo(1);
    expect(result.grossCost).toBeCloseTo(0.04);
    expect(result.savings).toBeCloseTo(0.004);
  });

  it('does not treat unrelated billing discounts as Auto Mode savings', () => {
    const rows: ProcessedData[] = [
      createRow({
        requestsUsed: 553.5,
        grossAmount: 22.14,
        netAmount: 3.32,
      }),
    ];

    const [result] = aggregateAutoModeSavings(rows);

    expect(result.requests).toBeCloseTo(615);
    expect(result.grossCost).toBeCloseTo(24.6);
    expect(result.savings).toBeCloseTo(2.46);
  });
});
