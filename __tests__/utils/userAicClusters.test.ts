import type { BillingUserTotals } from '@/utils/ingestion';
import { buildUserAicClusters, NEAR_ZERO_AIC_GROSS_AMOUNT_USD } from '@/utils/analytics/userAicClusters';

function makeBillingUser(user: string, aicGrossAmount: number): BillingUserTotals {
  return {
    user,
    quantity: aicGrossAmount * 10,
    aicGrossAmount,
  };
}

describe('user AI Credits clusters', () => {
  test('segments spenders by requested percentile bands after near-zero users', () => {
    const users = [
      makeBillingUser('test-user-zero', 0),
      makeBillingUser('test-user-near-zero', NEAR_ZERO_AIC_GROSS_AMOUNT_USD - 0.01),
      ...Array.from({ length: 20 }, (_, index) => makeBillingUser(`test-user-${index + 1}`, index + 1)),
    ];

    const clusters = buildUserAicClusters(users);
    const byName = new Map(clusters.map((cluster) => [cluster.cluster, cluster]));

    expect(clusters.map((cluster) => cluster.cluster)).toEqual([
      'Power Users',
      'Heavy Users',
      'Typical users',
      'Light users',
      'Near-zero users',
    ]);
    expect(byName.get('Power Users')?.users).toBe(1);
    expect(byName.get('Power Users')?.minAicGrossAmount).toBe(20);
    expect(byName.get('Heavy Users')?.users).toBe(3);
    expect(byName.get('Heavy Users')?.minAicGrossAmount).toBe(17);
    expect(byName.get('Heavy Users')?.maxAicGrossAmount).toBe(19);
    expect(byName.get('Typical users')?.users).toBe(11);
    expect(byName.get('Typical users')?.minAicGrossAmount).toBe(6);
    expect(byName.get('Typical users')?.maxAicGrossAmount).toBe(16);
    expect(byName.get('Light users')?.users).toBe(5);
    expect(byName.get('Light users')?.minAicGrossAmount).toBe(1);
    expect(byName.get('Light users')?.maxAicGrossAmount).toBe(5);
    expect(byName.get('Near-zero users')?.users).toBe(2);
    expect(byName.get('Near-zero users')?.maxAicGrossAmount).toBe(NEAR_ZERO_AIC_GROSS_AMOUNT_USD - 0.01);
  });

  test('treats one dollar as spend, not near-zero spend', () => {
    const clusters = buildUserAicClusters([
      makeBillingUser('test-user-near-zero', NEAR_ZERO_AIC_GROSS_AMOUNT_USD - 0.01),
      makeBillingUser('test-user-one-dollar', NEAR_ZERO_AIC_GROSS_AMOUNT_USD),
    ]);

    expect(clusters.map((cluster) => cluster.cluster)).toEqual(['Power Users', 'Near-zero users']);
  });
});
