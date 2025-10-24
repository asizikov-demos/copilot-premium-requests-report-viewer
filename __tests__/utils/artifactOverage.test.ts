import { computeOverageSummaryFromArtifacts } from '@/utils/ingestion/analytics';
import type { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';

describe('computeOverageSummaryFromArtifacts', () => {
  function makeUsage(users: Array<{ user: string; totalRequests: number; modelBreakdown?: Record<string, number> }>): UsageArtifacts {
    // Derive modelTotals + modelCount consistent with UsageAggregator output
    const modelTotals: Record<string, number> = {};
    for (const u of users) {
      const breakdown = u.modelBreakdown || { m: u.totalRequests };
      for (const [model, qty] of Object.entries(breakdown)) {
        modelTotals[model] = (modelTotals[model] || 0) + qty;
      }
    }
    const usage: UsageArtifacts = {
      users: users.map(u => ({ user: u.user, totalRequests: u.totalRequests, modelBreakdown: u.modelBreakdown || { m: u.totalRequests } })),
      modelTotals,
      userCount: users.length,
      modelCount: Object.keys(modelTotals).length
    };
    return usage;
  }
  function makeQuota(entries: Array<{ user: string; quota: number | 'unlimited' }>): QuotaArtifacts {
    const quotaByUser = new Map<string, number | 'unlimited'>();
    for (const e of entries) quotaByUser.set(e.user, e.quota);
    return { quotaByUser } as QuotaArtifacts;
  }

  it('returns zero overage when all users under quota', () => {
    const usage = makeUsage([
      { user: 'a', totalRequests: 100 },
      { user: 'b', totalRequests: 250 }
    ]);
    const quota = makeQuota([
      { user: 'a', quota: PRICING.BUSINESS_QUOTA },
      { user: 'b', quota: PRICING.BUSINESS_QUOTA }
    ]);
    const res = computeOverageSummaryFromArtifacts(usage, quota);
    expect(res.totalOverageRequests).toBe(0);
    expect(res.totalOverageCost).toBe(0);
  });

  it('calculates overage for users exceeding numeric quota', () => {
    const usage = makeUsage([
      { user: 'a', totalRequests: 400 }, // 100 over 300
      { user: 'b', totalRequests: 1200 } // 200 over 1000
    ]);
    const quota = makeQuota([
      { user: 'a', quota: PRICING.BUSINESS_QUOTA },
      { user: 'b', quota: PRICING.ENTERPRISE_QUOTA }
    ]);
    const res = computeOverageSummaryFromArtifacts(usage, quota);
    expect(res.totalOverageRequests).toBeCloseTo(300, 5);
    expect(res.totalOverageCost).toBeCloseTo(300 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('ignores unlimited users for overage', () => {
    const usage = makeUsage([
      { user: 'a', totalRequests: 5000 },
      { user: 'b', totalRequests: 50 }
    ]);
    const quota = makeQuota([
      { user: 'a', quota: 'unlimited' },
      { user: 'b', quota: PRICING.BUSINESS_QUOTA }
    ]);
    const res = computeOverageSummaryFromArtifacts(usage, quota);
    expect(res.totalOverageRequests).toBe(0);
    expect(res.totalOverageCost).toBe(0);
  });

  it('handles mixed quotas and partial overages', () => {
    const usage = makeUsage([
      { user: 'a', totalRequests: 305 }, // 5 over 300
      { user: 'b', totalRequests: 999 }, // under 1000
      { user: 'c', totalRequests: 1500 }, // 500 over 1000
      { user: 'd', totalRequests: 310 } // 10 over 300
    ]);
    const quota = makeQuota([
      { user: 'a', quota: PRICING.BUSINESS_QUOTA },
      { user: 'b', quota: PRICING.ENTERPRISE_QUOTA },
      { user: 'c', quota: PRICING.ENTERPRISE_QUOTA },
      { user: 'd', quota: PRICING.BUSINESS_QUOTA }
    ]);
    const res = computeOverageSummaryFromArtifacts(usage, quota);
    expect(res.totalOverageRequests).toBe(515);
    expect(res.totalOverageCost).toBeCloseTo(515 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('returns zeros for empty input', () => {
    const usage = makeUsage([]);
    const quota = makeQuota([]);
    const res = computeOverageSummaryFromArtifacts(usage, quota);
    expect(res.totalOverageRequests).toBe(0);
    expect(res.totalOverageCost).toBe(0);
  });
});
