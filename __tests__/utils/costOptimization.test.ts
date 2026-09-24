import { PRICING } from '@/constants/pricing';
import { computeCostOptimizationFromArtifacts } from '@/utils/analytics/costOptimization';
import type { BillingArtifacts, QuotaArtifacts, UsageArtifacts } from '@/utils/ingestion';

function makeCreditUsage(entries: Array<{ user: string; credits: number }>): UsageArtifacts {
  return {
    users: entries.map(({ user, credits }) => ({
      user,
      totalCredits: credits,
      modelBreakdown: { 'model-a': credits }
    })),
    modelTotals: { 'model-a': entries.reduce((sum, entry) => sum + entry.credits, 0) },
    userCount: entries.length,
    modelCount: 1
  };
}

function makeCreditQuota(entries: Array<{ user: string; quota: number }>): QuotaArtifacts {
  return {
    quotaByUser: new Map(entries.map(({ user, quota }) => [user, quota])),
    conflicts: new Map(),
    distinctQuotas: new Set(entries.map(entry => entry.quota)),
    hasMixedQuotas: false,
    hasMixedLicenses: false
  };
}

function makeBilling(charges: Record<string, number | undefined>): BillingArtifacts {
  const userMap = new Map(
    Object.entries(charges).map(([user, net]) => [user, { user, quantity: 0, net }])
  );
  return {
    totals: { gross: 0, discount: 0, net: 0, aicQuantity: 0, aicGrossAmount: 0 },
    users: Array.from(userMap.values()),
    userMap,
    orgTotals: new Map(),
    costCenterTotals: new Map(),
    billingByModel: new Map(),
    hasAnyBillingData: Object.values(charges).some(net => net !== undefined),
    hasAnyAicData: true
  };
}

describe('AI Credits cost monitoring', () => {
  it('uses billed net charges as supplied rather than estimating from credit usage', () => {
    const usage = makeCreditUsage([
      { user: 'test-user-one', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA + 2500 },
      { user: 'test-user-two', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA + 300 },
      { user: 'test-user-three', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA + 1200 }
    ]);
    const quota = makeCreditQuota(usage.users.map(({ user }) => ({ user, quota: PRICING.BUSINESS_AI_CREDIT_QUOTA })));
    const billing = makeBilling({ 'test-user-one': 12.5, 'test-user-two': 39.25, 'test-user-three': 0 });

    const result = computeCostOptimizationFromArtifacts(usage, quota, billing);
    expect(result?.overQuotaUsers.map(user => user.user)).toEqual(['test-user-two', 'test-user-one', 'test-user-three']);
    expect(result?.overQuotaUsers[0].billedNetCharge).toBe(39.25);
    expect(result?.overQuotaUsers[0].excessCredits).toBe(300);
    expect(result?.totalBilledNetCharge).toBeCloseTo(51.75);
    expect(result?.totalExcessCredits).toBe(4000);
    expect(result?.totalOverQuotaUsers).toBe(3);
  });

  it('treats missing billed net as unavailable rather than inventing charges', () => {
    const usage = makeCreditUsage([{ user: 'test-user-one', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA + 500 }]);
    const quota = makeCreditQuota([{ user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }]);

    expect(computeCostOptimizationFromArtifacts(usage, quota)).toBeNull();
    expect(computeCostOptimizationFromArtifacts(usage, quota, makeBilling({ 'test-user-one': undefined }))).toBeNull();
  });

  it('omits unbilled users, excludes Enterprise, and tracks near-quota users', () => {
    const usage = makeCreditUsage([
      { user: 'test-user-one', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA + 1 },
      { user: 'test-user-two', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA + 200 },
      { user: 'test-user-three', credits: PRICING.ENTERPRISE_AI_CREDIT_QUOTA + 100 },
      { user: 'test-user-four', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA * 0.9 },
      { user: 'test-user-five', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA * 0.8 },
      { user: 'test-user-six', credits: PRICING.BUSINESS_AI_CREDIT_QUOTA * 0.7 }
    ]);
    const quota = makeCreditQuota(usage.users.map(({ user }) => ({
      user, quota: user === 'test-user-three' ? PRICING.ENTERPRISE_AI_CREDIT_QUOTA : PRICING.BUSINESS_AI_CREDIT_QUOTA
    })));
    const billing = makeBilling({
      'test-user-one': 0,
      'test-user-two': undefined,
      'test-user-three': 80,
      'test-user-four': 3,
      'test-user-five': 2,
      'test-user-six': 1
    });

    const result = computeCostOptimizationFromArtifacts(usage, quota, billing);
    expect(result?.overQuotaUsers.map(user => user.user)).toEqual(['test-user-one']);
    expect(result?.nearQuotaUsers.map(user => user.user)).toEqual(['test-user-four', 'test-user-five']);
    expect(result?.totalBilledNetCharge).toBe(0);
    expect(result?.missingBillingUsers).toBe(1);
  });

  it('returns an empty, available summary when charges exist without over-quota usage', () => {
    const usage = makeCreditUsage([{ user: 'test-user-one', credits: 100 }]);
    const quota = makeCreditQuota([{ user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }]);
    const result = computeCostOptimizationFromArtifacts(usage, quota, makeBilling({ 'test-user-one': 0 }));

    expect(result?.overQuotaUsers).toEqual([]);
    expect(result?.nearQuotaUsers).toEqual([]);
    expect(result?.totalBilledNetCharge).toBe(0);
  });
});
