import { utcDateTickFormatter } from '@/components/charts/chartTooltipStyles';

describe('utcDateTickFormatter', () => {
  it('formats a YYYY-MM-DD date string as M/D using UTC', () => {
    expect(utcDateTickFormatter('2025-06-30')).toBe('6/30');
    expect(utcDateTickFormatter('2025-07-01')).toBe('7/1');
  });

  it('uses UTC and does not shift to local timezone', () => {
    // 2025-01-01T23:00:00Z is still Jan 1 in UTC, but Dec 31 in UTC-5.
    // Using UTC methods must yield 1/1, not 12/31.
    expect(utcDateTickFormatter('2025-01-01T23:00:00Z')).toBe('1/1');
  });
});
