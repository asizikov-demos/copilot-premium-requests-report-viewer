import { formatCurrency, formatDecimalQuantity, formatUtcDateLabel } from '@/utils/formatters';

describe('formatDecimalQuantity', () => {
  it('formats quantities with locale separators and exactly two decimal places', () => {
    expect(formatDecimalQuantity(1234.5)).toBe('1,234.50');
    expect(formatDecimalQuantity(0)).toBe('0.00');
    expect(formatDecimalQuantity(1000000.123)).toBe('1,000,000.12');
    expect(formatDecimalQuantity(0.001)).toBe('0.00');
    expect(formatDecimalQuantity(-100.99)).toBe('-100.99');
  });
});

describe('formatUtcDateLabel', () => {
  it.each([
    ['2026-06-03', 'Jun 3, 2026'],
    ['2026-06-01', 'Jun 1, 2026'],
    ['2026-06-30', 'Jun 30, 2026'],
    ['2026-12-31', 'Dec 31, 2026'],
    ['2027-01-01', 'Jan 1, 2027'],
    ['2024-02-29', 'Feb 29, 2024'],
  ])('formats %s as %s', (dateKey, expected) => {
    expect(formatUtcDateLabel(dateKey)).toBe(expected);
  });

  it('uses the default locale with explicit UTC formatting', () => {
    const formatterSpy = jest.spyOn(Intl, 'DateTimeFormat');

    try {
      formatUtcDateLabel('2026-06-03');

      expect(formatterSpy).toHaveBeenCalledWith(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } finally {
      formatterSpy.mockRestore();
    }
  });
});

describe('formatCurrency', () => {
  it('formats dollar amounts with thousands separators and two decimal places', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(1000000.123)).toBe('$1,000,000.12');
    expect(formatCurrency(0.001)).toBe('$0.00');
  });

  it('preserves the existing dollar-prefix behavior for negative values', () => {
    // Matches the previously duplicated `$${value.toLocaleString(...)}` formatter behavior.
    expect(formatCurrency(-100.99)).toBe('$-100.99');
  });
});
