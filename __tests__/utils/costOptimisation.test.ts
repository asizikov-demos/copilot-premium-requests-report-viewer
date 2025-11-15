import { computeCostOptimisationFromArtifacts } from '@/utils/analytics/costOptimisation';
import type { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';

function makeUsage(users: Array<{ user: string; totalRequests: number }>): UsageArtifacts {
  return {
    users: users.map(u => ({ user: u.user, totalRequests: u.totalRequests, modelBreakdown: {} })),
    userCount: users.length,
    modelTotals: {},
    modelCount: 0
  };
}

function makeQuota(entries: Array<{ user: string; quota: number | 'unlimited' }>): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unlimited'>();
  for (const e of entries) {
    quotaByUser.set(e.user, e.quota);
  }
  return { quotaByUser } as QuotaArtifacts;
}

describe('computeCostOptimisationFromArtifacts', () => {
  it('returns empty summary when no users qualify', () => {
    const usage = makeUsage([
      { user: 'a', totalRequests: 250 },
      { user: 'b', totalRequests: 700 } // overage 400, below 500 threshold
    ]);
    const quota = makeQuota([
      { user: 'a', quota: PRICING.BUSINESS_QUOTA },
      { user: 'b', quota: PRICING.BUSINESS_QUOTA }
    ]);
    const res = computeCostOptimisationFromArtifacts(usage, quota);
    expect(res.totalCandidates).toBe(0);
    expect(res.candidates).toHaveLength(0);
    expect(res.totalOverageCost).toBe(0);
    expect(res.totalPotentialSavings).toBe(0);
  });

  it('selects only business users with >= 500 overage', () => {
    const usage = makeUsage([
      { user: 'biz-low', totalRequests: PRICING.BUSINESS_QUOTA + 100 }, // far below threshold
      { user: 'biz-approaching', totalRequests: PRICING.BUSINESS_QUOTA + 450 }, // 450 over 300 -> approaching break-even
      { user: 'biz-high', totalRequests: PRICING.BUSINESS_QUOTA + 600 }, // qualifies for strong recommendation
      { user: 'ent-high', totalRequests: PRICING.ENTERPRISE_QUOTA + 800 } // non-business
    ]);
    const quota = makeQuota([
      { user: 'biz-low', quota: PRICING.BUSINESS_QUOTA },
      { user: 'biz-approaching', quota: PRICING.BUSINESS_QUOTA },
      { user: 'biz-high', quota: PRICING.BUSINESS_QUOTA },
      { user: 'ent-high', quota: PRICING.ENTERPRISE_QUOTA }
    ]);

    const res = computeCostOptimisationFromArtifacts(usage, quota);
    // Strong recommendation list
    expect(res.totalCandidates).toBe(1);
    expect(res.candidates).toHaveLength(1);
    const candidate = res.candidates[0];
    expect(candidate.user).toBe('biz-high');
    expect(candidate.quota).toBe(PRICING.BUSINESS_QUOTA);
    expect(candidate.overageRequests).toBe(600);
    expect(candidate.overageCost).toBeCloseTo(600 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);

    // Approaching break-even list
    expect(res.approachingBreakEven).toHaveLength(1);
    const approaching = res.approachingBreakEven[0];
    expect(approaching.user).toBe('biz-approaching');
    expect(approaching.overageRequests).toBe(450);
  });

  it('aggregates costs and potential savings across candidates', () => {
    const usage = makeUsage([
      { user: 'u1', totalRequests: PRICING.BUSINESS_QUOTA + 500 },
      { user: 'u2', totalRequests: PRICING.BUSINESS_QUOTA + 800 }
    ]);
    const quota = makeQuota([
      { user: 'u1', quota: PRICING.BUSINESS_QUOTA },
      { user: 'u2', quota: PRICING.BUSINESS_QUOTA }
    ]);

    const res = computeCostOptimisationFromArtifacts(usage, quota);
    expect(res.totalCandidates).toBe(2);

    const expectedOverage = 500 + 800;
    expect(res.totalOverageCost).toBeCloseTo(expectedOverage * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
    // Enterprise upgrade is a fixed USD20 per seat
    expect(res.estimatedEnterpriseCost).toBeCloseTo(2 * 20, 5);
    expect(res.totalPotentialSavings).toBeGreaterThanOrEqual(0);
  });
});
