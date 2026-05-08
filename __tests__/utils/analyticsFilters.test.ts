import { filterBySelectedMonths, getAvailableMonths, getMonthKey } from '@/utils/analytics/filters';

import type { ProcessedData } from '@/types/csv';

function createProcessedData(timestamp: string, monthKey = ''): ProcessedData {
  const date = new Date(timestamp);
  return {
    timestamp: date,
    user: 'test-user-one',
    model: 'test-model-one',
    requestsUsed: 1,
    exceedsQuota: false,
    totalQuota: 'Unlimited',
    quotaValue: 'unlimited',
    iso: date.toISOString(),
    dateKey: date.toISOString().slice(0, 10),
    monthKey,
    epoch: date.getTime()
  };
}

describe('analytics filters month helpers', () => {
  it('derives fallback month keys from UTC timestamps', () => {
    expect(getMonthKey(createProcessedData('2025-06-30T23:59:59Z'))).toBe('2025-06');
    expect(getMonthKey(createProcessedData('2025-07-01T00:00:00Z'))).toBe('2025-07');
  });

  it('prefers cached row month keys when available', () => {
    expect(getMonthKey(createProcessedData('2025-06-30T23:59:59Z', '2025-08'))).toBe('2025-08');
  });

  it('uses shared month labels for available months', () => {
    const months = getAvailableMonths([
      createProcessedData('2025-07-01T00:00:00Z'),
      createProcessedData('2025-06-30T23:59:59Z'),
      createProcessedData('2025-07-15T00:00:00Z')
    ]);

    expect(months).toEqual([
      { value: '2025-06', label: 'June 2025' },
      { value: '2025-07', label: 'July 2025' }
    ]);
  });

  it('filters selected months using the shared month key fallback', () => {
    const june = createProcessedData('2025-06-30T23:59:59Z');
    const july = createProcessedData('2025-07-01T00:00:00Z');

    expect(filterBySelectedMonths([june, july], ['2025-06'])).toEqual([june]);
  });
});
