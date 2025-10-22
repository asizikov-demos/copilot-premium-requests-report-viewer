import { computeOverageSummary } from '@/utils/analytics/overage';
import { UserSummary } from '@/utils/analytics/powerUsers';
import { ProcessedData } from '@/types/csv';
import { PRICING } from '@/constants/pricing';

function makeProcessed(user: string, requests: number, quota: number | 'unlimited'): ProcessedData {
  return {
    timestamp: new Date('2025-06-01T00:00:00Z'),
    user,
    model: 'gpt-4.1-test',
    requestsUsed: requests,
    exceedsQuota: quota !== 'unlimited' ? requests > quota : false,
    totalQuota: quota === 'unlimited' ? 'Unlimited' : String(quota),
    quotaValue: quota
  };
}

describe('computeOverageSummary', () => {
  it('returns zero overage when all users under quota', () => {
    const userData: UserSummary[] = [
      { user: 'a', totalRequests: 100, modelBreakdown: { m: 100 } },
      { user: 'b', totalRequests: 250, modelBreakdown: { m: 250 } }
    ];
    const processed: ProcessedData[] = [
      makeProcessed('a', 100, PRICING.BUSINESS_QUOTA),
      makeProcessed('b', 250, PRICING.BUSINESS_QUOTA)
    ];
    const res = computeOverageSummary(userData, processed);
    expect(res.totalOverageRequests).toBe(0);
    expect(res.totalOverageCost).toBe(0);
  });

  it('calculates overage for users exceeding numeric quota', () => {
    const userData: UserSummary[] = [
      { user: 'a', totalRequests: 400, modelBreakdown: { m: 400 } }, // 100 over Business 300
      { user: 'b', totalRequests: 1200, modelBreakdown: { m: 1200 } } // 200 over Enterprise 1000
    ];
    const processed: ProcessedData[] = [
      makeProcessed('a', 400, PRICING.BUSINESS_QUOTA),
      makeProcessed('b', 1200, PRICING.ENTERPRISE_QUOTA)
    ];
    const res = computeOverageSummary(userData, processed);
    expect(res.totalOverageRequests).toBeCloseTo(300, 5);
    expect(res.totalOverageCost).toBeCloseTo(300 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('ignores unlimited users for overage', () => {
    const userData: UserSummary[] = [
      { user: 'a', totalRequests: 5000, modelBreakdown: { m: 5000 } },
      { user: 'b', totalRequests: 50, modelBreakdown: { m: 50 } }
    ];
    const processed: ProcessedData[] = [
      makeProcessed('a', 5000, 'unlimited'),
      makeProcessed('b', 50, PRICING.BUSINESS_QUOTA)
    ];
    const res = computeOverageSummary(userData, processed);
    expect(res.totalOverageRequests).toBe(0);
    expect(res.totalOverageCost).toBe(0);
  });

  it('handles mixed quotas and partial overages', () => {
    const userData: UserSummary[] = [
      { user: 'a', totalRequests: 305, modelBreakdown: { m: 305 } }, // 5 over 300
      { user: 'b', totalRequests: 999, modelBreakdown: { m: 999 } }, // under 1000
      { user: 'c', totalRequests: 1500, modelBreakdown: { m: 1500 } }, // 500 over 1000
      { user: 'd', totalRequests: 310, modelBreakdown: { m: 310 } } // 10 over 300
    ];
    const processed: ProcessedData[] = [
      makeProcessed('a', 305, PRICING.BUSINESS_QUOTA),
      makeProcessed('b', 999, PRICING.ENTERPRISE_QUOTA),
      makeProcessed('c', 1500, PRICING.ENTERPRISE_QUOTA),
      makeProcessed('d', 310, PRICING.BUSINESS_QUOTA)
    ];
    const res = computeOverageSummary(userData, processed);
    // 5 + 0 + 500 + 10 = 515
    expect(res.totalOverageRequests).toBe(515);
    expect(res.totalOverageCost).toBeCloseTo(515 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('returns zeros for empty input', () => {
    const res = computeOverageSummary([], []);
    expect(res.totalOverageRequests).toBe(0);
    expect(res.totalOverageCost).toBe(0);
  });
});
