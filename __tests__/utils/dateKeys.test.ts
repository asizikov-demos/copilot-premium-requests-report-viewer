import { MONTH_NAMES, buildDateKeys, dayOfMonthToWeekBucket, enumerateDatesInclusive, monthKeyToLabel } from '@/utils/dateKeys';

describe('buildDateKeys', () => {
  function assertKeys(d: Date) {
    const { iso, dateKey, monthKey, epoch } = buildDateKeys(d);
    expect(iso).toBe(d.toISOString());
    expect(dateKey).toBe(iso.slice(0, 10));
    expect(monthKey).toBe(iso.slice(0, 7));
    expect(epoch).toBe(d.getTime());
    // Basic format validations
    expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(monthKey).toMatch(/^\d{4}-\d{2}$/);
  }

  it('handles normal mid-month date', () => {
    assertKeys(new Date('2025-06-15T12:34:56Z'));
  });

  it('handles month end boundary', () => {
    assertKeys(new Date('2025-01-31T23:59:59Z'));
  });

  it('handles leap year Feb 29', () => {
    assertKeys(new Date('2024-02-29T00:00:00Z'));
  });

  it('handles year rollover Dec 31 to Jan 01', () => {
    assertKeys(new Date('2025-12-31T23:59:59Z'));
    assertKeys(new Date('2026-01-01T00:00:00Z'));
  });

  it('returns stable primitives (mutation of original date does not retroactively change keys)', () => {
    const original = new Date('2025-07-04T00:00:00Z');
    const first = buildDateKeys(original);
    original.setUTCDate(10); // mutate date object
    const second = buildDateKeys(original);
    // First snapshot should remain consistent with its original ISO
    expect(first.dateKey).toBe('2025-07-04');
    expect(second.dateKey).toBe('2025-07-10');
  });
});

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

describe('dayOfMonthToWeekBucket', () => {
  it('maps fixed seven-day ranges to week buckets', () => {
    expect(dayOfMonthToWeekBucket(1, '2025-06')).toEqual({
      weekNumber: 1,
      startDate: '2025-06-01',
      endDate: '2025-06-07'
    });
    expect(dayOfMonthToWeekBucket(14, '2025-06')).toEqual({
      weekNumber: 2,
      startDate: '2025-06-08',
      endDate: '2025-06-14'
    });
    expect(dayOfMonthToWeekBucket(21, '2025-06')).toEqual({
      weekNumber: 3,
      startDate: '2025-06-15',
      endDate: '2025-06-21'
    });
    expect(dayOfMonthToWeekBucket(28, '2025-06')).toEqual({
      weekNumber: 4,
      startDate: '2025-06-22',
      endDate: '2025-06-28'
    });
  });

  it('uses the UTC month end for week 5 boundaries', () => {
    expect(dayOfMonthToWeekBucket(29, '2024-02')).toEqual({
      weekNumber: 5,
      startDate: '2024-02-29',
      endDate: '2024-02-29'
    });
    expect(dayOfMonthToWeekBucket(30, '2025-04')).toEqual({
      weekNumber: 5,
      startDate: '2025-04-29',
      endDate: '2025-04-30'
    });
    expect(dayOfMonthToWeekBucket(31, '2025-07')).toEqual({
      weekNumber: 5,
      startDate: '2025-07-29',
      endDate: '2025-07-31'
    });
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
