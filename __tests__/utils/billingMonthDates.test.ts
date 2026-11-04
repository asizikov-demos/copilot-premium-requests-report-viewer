import { buildBillingMonthDates } from '@/utils/dateKeys';

describe('buildBillingMonthDates', () => {
  it.each([
    ['2024-02', 29], ['2025-02', 28], ['2026-04', 30],
    ['2026-03', 31], ['2026-10', 31], ['2026-12', 31], ['2027-01', 31],
  ])('enumerates every UTC day of %s independently of today', (month, days) => {
    expect(buildBillingMonthDates([month])).toEqual(
      Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
    );
  });

  it('sorts and deduplicates selected months without filling unselected months or mutating input', () => {
    const months = ['2027-01', '2026-11', '2027-01'];
    const dates = buildBillingMonthDates(months);
    expect(dates).toHaveLength(61);
    expect(dates[0]).toBe('2026-11-01');
    expect(dates[29]).toBe('2026-11-30');
    expect(dates[30]).toBe('2027-01-01');
    expect(dates[60]).toBe('2027-01-31');
    expect(months).toEqual(['2027-01', '2026-11', '2027-01']);
    expect(buildBillingMonthDates(new Set(months))).toEqual(dates);
    expect(buildBillingMonthDates([])).toEqual([]);
  });

  it.each(['2026-00', '2026-13', '2026-2', '2026-02-15', 'invalid'])(
    'rejects invalid month keys explicitly: %s', month => {
      expect(() => buildBillingMonthDates([month])).toThrow(RangeError);
    }
  );
});
