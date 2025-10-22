import { processCSVData } from '@/utils/analytics/transformations';
import { newFormatRows } from '../fixtures/newFormatCSVData';

describe('processCSVData (new expanded CSV format)', () => {
  it('maps new-format rows into unified ProcessedData correctly', () => {
    const processed = processCSVData(newFormatRows);
    expect(processed).toHaveLength(2);

    const first = processed[0];
    expect(first.sourceFormat).toBe('new');
    expect(first.user).toBe('alice');
    expect(first.model).toBe('Claude Sonnet 4');
    expect(first.requestsUsed).toBeCloseTo(3.6);
    expect(first.exceedsQuota).toBe(false);
    expect(first.quotaValue).toBe(1000);
    expect(first.totalQuota).toBe('1000');
    expect(first.timestamp.toISOString()).toBe('2025-10-01T00:00:00.000Z');
    expect(first.product).toBe('copilot');
    expect(first.organization).toBe('org-alpha');
    expect(first.appliedCostPerQuantity).toBeCloseTo(0.04);
    expect(first.netAmount).toBeCloseTo(0.144);

    const second = processed[1];
    expect(second.sourceFormat).toBe('new');
    expect(second.user).toBe('bob');
    expect(second.quotaValue).toBe('unlimited');
    expect(second.totalQuota.toLowerCase()).toBe('unlimited');
    expect(second.timestamp.toISOString()).toBe('2025-10-02T00:00:00.000Z');
    expect(second.requestsUsed).toBe(12);
  });

  it('handles mixed numeric formatting & boolean normalization', () => {
    const processed = processCSVData(newFormatRows);
    processed.forEach(r => {
      expect(typeof r.requestsUsed).toBe('number');
      expect(typeof r.exceedsQuota).toBe('boolean');
      expect(['legacy','new']).toContain(r.sourceFormat);
    });
  });
});
