import { classifyQuotaMap, shouldReplaceQuotaValue } from '@/utils/analytics/quota';
import { PRICING } from '@/constants/pricing';

describe('shouldReplaceQuotaValue', () => {
  test.each([
    [undefined, 'unknown', true],
    [undefined, PRICING.BUSINESS_AI_CREDIT_QUOTA, true],
    ['unknown', PRICING.BUSINESS_AI_CREDIT_QUOTA, true],
    [PRICING.BUSINESS_AI_CREDIT_QUOTA, 'unknown', false],
    [PRICING.BUSINESS_AI_CREDIT_QUOTA, PRICING.ENTERPRISE_AI_CREDIT_QUOTA, true],
    [PRICING.ENTERPRISE_AI_CREDIT_QUOTA, PRICING.BUSINESS_AI_CREDIT_QUOTA, false],
    [1000, PRICING.BUSINESS_AI_CREDIT_QUOTA, true],
    [PRICING.BUSINESS_AI_CREDIT_QUOTA, 1000, false],
    [PRICING.BUSINESS_AI_CREDIT_QUOTA, PRICING.BUSINESS_AI_CREDIT_QUOTA, false],
    ['unknown', 'unknown', false],
  ] as const)('shouldReplaceQuotaValue(%p, %p) returns %p', (existing, incoming, expected) => {
    expect(shouldReplaceQuotaValue(existing, incoming)).toBe(expected);
  });
});

describe('classifyQuotaMap', () => {
  test('buckets users by tier and suggests business for business-only quotas', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA],
      ['test-user-two', PRICING.BUSINESS_AI_CREDIT_QUOTA],
    ]));
    expect(result).toEqual({
      unknown: [],
      business: ['test-user-one', 'test-user-two'],
      enterprise: [],
      mixed: false,
      suggestedPlan: 'business',
    });
  });

  test('suggests enterprise for enterprise-only quotas', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['test-user-three', PRICING.ENTERPRISE_AI_CREDIT_QUOTA],
    ]));
    expect(result.enterprise).toEqual(['test-user-three']);
    expect(result.suggestedPlan).toBe('enterprise');
    expect(result.mixed).toBe(false);
  });

  test('flags mixed and suppresses suggestion across tiers', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA],
      ['test-user-three', PRICING.ENTERPRISE_AI_CREDIT_QUOTA],
    ]));
    expect(result.mixed).toBe(true);
    expect(result.suggestedPlan).toBeNull();
  });

  test('suppresses suggestion when any quota is unknown', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA],
      ['test-user-four', 'unknown'],
    ]));
    expect(result.unknown).toEqual(['test-user-four']);
    expect(result.mixed).toBe(true);
    expect(result.suggestedPlan).toBeNull();
  });

  test('ignores quota values that match no known tier', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['test-user-five', 42],
    ]));
    expect(result).toEqual({
      unknown: [],
      business: [],
      enterprise: [],
      mixed: false,
      suggestedPlan: null,
    });
  });

  test('buckets current AI Credits quota values by Copilot tier', () => {
    const result = classifyQuotaMap(new Map<string, number | 'unknown'>([
      ['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA],
      ['test-user-two', PRICING.ENTERPRISE_AI_CREDIT_QUOTA],
    ]));

    expect(result.business).toEqual(['test-user-one']);
    expect(result.enterprise).toEqual(['test-user-two']);
    expect(result.unknown).toEqual([]);
    expect(result.mixed).toBe(true);
  });
});
