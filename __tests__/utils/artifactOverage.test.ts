import { computeOverageSummaryFromArtifacts, computeOverageSummaryFromProcessedData } from '@/utils/ingestion/analytics';
import type { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';

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
  function makeQuota(entries: Array<{ user: string; quota: number | 'unknown' }>): QuotaArtifacts {
    const quotaByUser = new Map<string, number | 'unknown'>();
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

  it('ignores unknown users for overage', () => {
    const usage = makeUsage([
      { user: 'a', totalRequests: 5000 },
      { user: 'b', totalRequests: 50 }
    ]);
    const quota = makeQuota([
      { user: 'a', quota: 'unknown' },
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

describe('computeOverageSummaryFromProcessedData', () => {
  const makeRow = ({
    user = 'alice',
    requestsUsed,
    exceedsQuota,
    netAmount,
    grossAmount,
    discountAmount,
    quotaValue = PRICING.ENTERPRISE_QUOTA,
    dateKey,
  }: {
    user?: string;
    requestsUsed: number;
    exceedsQuota: boolean;
    netAmount?: number;
    grossAmount?: number;
    discountAmount?: number;
    quotaValue?: number | 'unknown';
    dateKey: string;
  }): ProcessedData => ({
    timestamp: new Date(`${dateKey}T00:00:00Z`),
    user,
    model: 'GPT-5',
    requestsUsed,
    exceedsQuota,
    totalQuota: quotaValue === 'unknown' ? 'Unknown' : quotaValue.toString(),
    quotaValue,
    iso: `${dateKey}T00:00:00.000Z`,
    dateKey,
    monthKey: dateKey.slice(0, 7),
    epoch: new Date(`${dateKey}T00:00:00Z`).getTime(),
    grossAmount,
    discountAmount,
    netAmount,
  });

  it('prefers billed overage rows when present', () => {
    const result = computeOverageSummaryFromProcessedData([
      makeRow({
        requestsUsed: 999,
        exceedsQuota: false,
        netAmount: 0,
        grossAmount: 999 * PRICING.OVERAGE_RATE_PER_REQUEST,
        discountAmount: 999 * PRICING.OVERAGE_RATE_PER_REQUEST,
        dateKey: '2025-10-17',
      }),
      makeRow({
        requestsUsed: 1,
        exceedsQuota: false,
        netAmount: 0,
        grossAmount: PRICING.OVERAGE_RATE_PER_REQUEST,
        discountAmount: PRICING.OVERAGE_RATE_PER_REQUEST,
        dateKey: '2025-10-18',
      }),
      makeRow({
        requestsUsed: 94,
        exceedsQuota: true,
        netAmount: 94 * PRICING.OVERAGE_RATE_PER_REQUEST,
        grossAmount: 94 * PRICING.OVERAGE_RATE_PER_REQUEST,
        discountAmount: 0,
        dateKey: '2025-10-18',
      }),
      makeRow({
        requestsUsed: 10,
        exceedsQuota: true,
        netAmount: 10 * PRICING.OVERAGE_RATE_PER_REQUEST,
        grossAmount: 10 * PRICING.OVERAGE_RATE_PER_REQUEST,
        discountAmount: 0,
        dateKey: '2025-10-19',
      }),
    ]);

    expect(result.totalOverageRequests).toBe(104);
    expect(result.totalOverageCost).toBeCloseTo(104 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('falls back to estimated overage when billed rows have no billing amounts', () => {
    const result = computeOverageSummaryFromProcessedData([
      makeRow({
        user: 'alice',
        requestsUsed: 1000,
        exceedsQuota: false,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
        dateKey: '2025-10-17',
      }),
      makeRow({
        user: 'alice',
        requestsUsed: 25,
        exceedsQuota: true,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
        dateKey: '2025-10-18',
      }),
    ]);

    expect(result.totalOverageRequests).toBe(25);
    expect(result.totalOverageCost).toBeCloseTo(25 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('resolves mixed quota rows using the higher effective quota', () => {
    const result = computeOverageSummaryFromProcessedData([
      makeRow({
        user: 'alice',
        requestsUsed: 800,
        exceedsQuota: false,
        quotaValue: PRICING.BUSINESS_QUOTA,
        dateKey: '2025-10-17',
      }),
      makeRow({
        user: 'alice',
        requestsUsed: 150,
        exceedsQuota: false,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
        dateKey: '2025-10-18',
      }),
    ]);

    expect(result.totalOverageRequests).toBe(0);
    expect(result.totalOverageCost).toBe(0);
  });
});
