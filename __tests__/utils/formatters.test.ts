import { formatCurrency } from '@/utils/formatters';

describe('formatCurrency', () => {
  it('formats dollar amounts with thousands separators and two decimal places', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(-100.99)).toBe('$-100.99');
    expect(formatCurrency(1000000.123)).toBe('$1,000,000.12');
    expect(formatCurrency(0.001)).toBe('$0.00');
  });
});
