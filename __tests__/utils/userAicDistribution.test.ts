import type { BillingUserTotals } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';
import { buildUserAicDistribution, NEAR_ZERO_AIC_QUANTITY } from '@/utils/analytics/userAicDistribution';

function makeBillingUser(user: string, aiCredits: number): BillingUserTotals {
  return {
    user,
    quantity: aiCredits,
    overage: { requests: 0, cost: 0, hasBilledOverageData: false },
    aicQuantity: aiCredits,
    aicGrossAmount: aiCredits * PRICING.AI_CREDIT_USD_VALUE,
  };
}

describe('user AI Credits distribution', () => {
  test('segments users into defined consumption groups', () => {
    const distribution = buildUserAicDistribution([
      makeBillingUser('test-user-zero', 0),
      makeBillingUser('test-user-near-zero', NEAR_ZERO_AIC_QUANTITY - 0.01),
      ...Array.from({ length: 20 }, (_, index) => makeBillingUser(`test-user-${index + 1}`, index + 1)),
    ]);
    const byName = new Map(distribution.groups.map((group) => [group.label, group]));

    expect(distribution.groups.map((group) => group.label)).toEqual(['Power', 'Heavy', 'Typical', 'Light', 'Near-zero']);
    expect(byName.get('Near-zero')?.users).toBe(2);
    expect(byName.get('Light')?.users).toBe(5);
    expect(byName.get('Light')?.minAiCredits).toBe(1);
    expect(byName.get('Light')?.maxAiCredits).toBe(5);
    expect(byName.get('Typical')?.users).toBe(11);
    expect(byName.get('Typical')?.minAiCredits).toBe(6);
    expect(byName.get('Typical')?.maxAiCredits).toBe(16);
    expect(byName.get('Heavy')?.users).toBe(3);
    expect(byName.get('Heavy')?.minAiCredits).toBe(17);
    expect(byName.get('Heavy')?.maxAiCredits).toBe(19);
    expect(byName.get('Power')?.users).toBe(1);
    expect(byName.get('Power')?.minAiCredits).toBe(20);
    expect(byName.get('Power')?.totalGrossCost).toBe(20 * PRICING.AI_CREDIT_USD_VALUE);
  });

  test('treats one AI Credit as active usage, not near-zero usage', () => {
    const distribution = buildUserAicDistribution([
      makeBillingUser('test-user-near-zero', NEAR_ZERO_AIC_QUANTITY - 0.01),
      makeBillingUser('test-user-one-credit', NEAR_ZERO_AIC_QUANTITY),
    ]);

    expect(distribution.groups.map((group) => [group.label, group.users])).toEqual([
      ['Power', 1],
      ['Heavy', 0],
      ['Typical', 0],
      ['Light', 0],
      ['Near-zero', 1],
    ]);
    expect(distribution.activeUsers).toBe(1);
  });

  test('derives AI Credits from gross amount when quantity is unavailable', () => {
    const distribution = buildUserAicDistribution([
      {
        user: 'test-user-derived',
        quantity: 0,
        overage: { requests: 0, cost: 0, hasBilledOverageData: false },
        aicGrossAmount: 2,
      },
    ]);

    expect(distribution.totalAiCredits).toBe(200);
    expect(distribution.totalGrossCost).toBe(2);
    expect(distribution.groups.find((group) => group.label === 'Power')?.users).toBe(1);
  });
});
