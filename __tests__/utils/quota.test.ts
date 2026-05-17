import { shouldReplaceQuotaValue } from '@/utils/analytics/quota';

describe('shouldReplaceQuotaValue', () => {
  test.each([
    [undefined, 'unknown', true],
    [undefined, 300, true],
    ['unknown', 300, true],
    [300, 'unknown', false],
    [300, 1000, true],
    [1000, 300, false],
    [300, 300, false],
    ['unknown', 'unknown', false],
  ] as const)('shouldReplaceQuotaValue(%p, %p) returns %p', (existing, incoming, expected) => {
    expect(shouldReplaceQuotaValue(existing, incoming)).toBe(expected);
  });
});
