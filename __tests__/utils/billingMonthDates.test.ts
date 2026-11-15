import { buildBillingMonthDates } from '@/utils/dateKeys';

describe('buildBillingMonthDates', () => {
  it.each([
    ['2024-02', 29], ['2025-02', 28], ['2026-04', 30],
    ['2026-03', 31], ['2026-10', 31], ['2026-12', 31], ['2027-01', 31],
  ])('enumerates every UTC day of %s independently of today', (month, days) => {
    expect(buildBillingMonthDates(month)).toEqual(
      Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
    );
  });

  it('returns no timeline when the report has no rows', () => {
    expect(buildBillingMonthDates(undefined)).toEqual([]);
  });

  it.each(['2026-00', '2026-13', '2026-2', '2026-02-15', 'invalid'])(
    'rejects invalid month keys explicitly: %s', month => {
      expect(() => buildBillingMonthDates(month)).toThrow(RangeError);
    }
  );
});
