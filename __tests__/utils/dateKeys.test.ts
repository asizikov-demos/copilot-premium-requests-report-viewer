import { buildDateKeys } from '@/utils/dateKeys';

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
