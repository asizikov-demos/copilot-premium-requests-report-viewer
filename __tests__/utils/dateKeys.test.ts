import { MONTH_NAMES, enumerateDatesInclusive, monthKeyToLabel } from '@/utils/dateKeys';

describe('monthKeyToLabel', () => {
  it('formats month keys without timezone conversion', () => {
    expect(monthKeyToLabel('2025-06')).toBe('June 2025');
    expect(monthKeyToLabel('2026-01')).toBe('January 2026');
    expect(monthKeyToLabel('2024-12')).toBe('December 2024');
  });

  it('exports the shared month name source', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });
});

describe('enumerateDatesInclusive', () => {
  it('enumerates single day range', () => {
    const result = enumerateDatesInclusive('2025-06-15', '2025-06-15');
    expect(result).toEqual(['2025-06-15']);
  });

  it('enumerates multiple days in same month', () => {
    const result = enumerateDatesInclusive('2025-06-01', '2025-06-03');
    expect(result).toEqual(['2025-06-01', '2025-06-02', '2025-06-03']);
  });

  it('enumerates dates across month boundary', () => {
    const result = enumerateDatesInclusive('2025-06-29', '2025-07-02');
    expect(result).toEqual(['2025-06-29', '2025-06-30', '2025-07-01', '2025-07-02']);
  });

  it('enumerates dates across year boundary', () => {
    const result = enumerateDatesInclusive('2025-12-30', '2026-01-02');
    expect(result).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
  });

  it('handles leap year February', () => {
    const result = enumerateDatesInclusive('2024-02-28', '2024-03-01');
    expect(result).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
  });

  it('handles non-leap year February', () => {
    const result = enumerateDatesInclusive('2025-02-28', '2025-03-01');
    expect(result).toEqual(['2025-02-28', '2025-03-01']);
  });

  it('returns dates in UTC without timezone conversion', () => {
    // The function should treat dates as UTC regardless of local timezone
    const result = enumerateDatesInclusive('2025-06-15', '2025-06-17');
    expect(result).toEqual(['2025-06-15', '2025-06-16', '2025-06-17']);
    // Ensure format is YYYY-MM-DD
    result.forEach(date => {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
