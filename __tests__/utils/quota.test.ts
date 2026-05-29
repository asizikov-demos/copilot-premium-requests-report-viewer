import { classifyQuotaMap, shouldReplaceQuotaValue } from '@/utils/analytics/quota';
import { PRICING } from '@/constants/pricing';

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

describe('classifyQuotaMap', () => {
  test('buckets users by tier and suggests business for business-only quotas', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['alice', PRICING.BUSINESS_QUOTA],
      ['bob', PRICING.BUSINESS_QUOTA],
    ]));
    expect(result).toEqual({
      unknown: [],
      business: ['alice', 'bob'],
      enterprise: [],
      mixed: false,
      suggestedPlan: 'business',
    });
  });

  test('suggests enterprise for enterprise-only quotas', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['carol', PRICING.ENTERPRISE_QUOTA],
    ]));
    expect(result.enterprise).toEqual(['carol']);
    expect(result.suggestedPlan).toBe('enterprise');
    expect(result.mixed).toBe(false);
  });

  test('flags mixed and suppresses suggestion across tiers', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['alice', PRICING.BUSINESS_QUOTA],
      ['carol', PRICING.ENTERPRISE_QUOTA],
    ]));
    expect(result.mixed).toBe(true);
    expect(result.suggestedPlan).toBeNull();
  });

  test('suppresses suggestion when any quota is unknown', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['alice', PRICING.BUSINESS_QUOTA],
      ['dave', 'unknown'],
    ]));
    expect(result.unknown).toEqual(['dave']);
    expect(result.mixed).toBe(true);
    expect(result.suggestedPlan).toBeNull();
  });

  test('ignores quota values that match no known tier', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['eve', 42],
    ]));
    expect(result).toEqual({
      unknown: [],
      business: [],
      enterprise: [],
      mixed: false,
      suggestedPlan: null,
    });
  });
});
