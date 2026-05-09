import { computeOverageSummary as computeOverageSummaryShim } from '@/utils/analytics/artifactShims';
import { computeOverageSummary } from '@/utils/analytics/overage';
import { computeOverageSummaryFromArtifacts, computeOverageSummaryFromProcessedData } from '@/utils/ingestion/analytics';
import type { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';

function makeUsage(users: Array<{ user: string; totalRequests: number }>): UsageArtifacts {
  const modelTotals: Record<string, number> = {};
  users.forEach(u => { modelTotals['m'] = (modelTotals['m'] || 0) + u.totalRequests; });
  return {
    users: users.map(u => ({ user: u.user, totalRequests: u.totalRequests, modelBreakdown: { m: u.totalRequests } })),
    modelTotals,
    userCount: users.length,
    modelCount: Object.keys(modelTotals).length
  } as UsageArtifacts;
}

function makeQuota(entries: Array<{ user: string; quota: number | 'unknown' }>): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unknown'>();
  for (const e of entries) quotaByUser.set(e.user, e.quota);
  return { quotaByUser, conflicts: new Map(), distinctQuotas: new Set(), hasMixedQuotas: false, hasMixedLicenses: false } as QuotaArtifacts;
}

function makeProcessed(row: Partial<ProcessedData>): ProcessedData {
  const timestamp = row.timestamp || new Date('2025-06-01T00:00:00Z');
  const iso = timestamp.toISOString();
  return {
    timestamp,
    user: row.user || 'test-user-one',
    model: row.model || 'test-model',
    requestsUsed: row.requestsUsed ?? 0,
    exceedsQuota: row.exceedsQuota ?? false,
    totalQuota: row.totalQuota || String(row.quotaValue ?? PRICING.BUSINESS_QUOTA),
    quotaValue: row.quotaValue ?? PRICING.BUSINESS_QUOTA,
    iso,
    dateKey: iso.slice(0, 10),
    monthKey: iso.slice(0, 7),
    epoch: timestamp.getTime(),
    isNonCopilotUsage: row.isNonCopilotUsage ?? false,
    usageBucket: row.usageBucket,
  } as ProcessedData;
}

describe('computeOverageSummary', () => {
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
      { user: 'a', totalRequests: 305 },
      { user: 'b', totalRequests: 999 },
      { user: 'c', totalRequests: 1500 },
      { user: 'd', totalRequests: 310 }
    ]);
    const quota = makeQuota([
      { user: 'a', quota: PRICING.BUSINESS_QUOTA },
      { user: 'b', quota: PRICING.ENTERPRISE_QUOTA },
      { user: 'c', quota: PRICING.ENTERPRISE_QUOTA },
      { user: 'd', quota: PRICING.BUSINESS_QUOTA }
    ]);
    const res = computeOverageSummaryFromArtifacts(usage, quota);
    // 5 + 0 + 500 + 10 = 515
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

  it('resolves conflicting processed row quotas consistently', () => {
    const users: UserSummary[] = [
      { user: 'test-user-one', totalRequests: 400, modelBreakdown: { 'test-model': 400 } },
      { user: 'test-user-two', totalRequests: 1200, modelBreakdown: { 'test-model': 1200 } },
    ];
    const processed = [
      makeProcessed({ user: 'test-user-one', requestsUsed: 400, quotaValue: PRICING.BUSINESS_QUOTA }),
      makeProcessed({ user: 'test-user-one', requestsUsed: 0, quotaValue: PRICING.ENTERPRISE_QUOTA }),
      makeProcessed({ user: 'test-user-two', requestsUsed: 1200, quotaValue: PRICING.BUSINESS_QUOTA }),
      makeProcessed({ user: 'test-user-two', requestsUsed: 0, quotaValue: 'unknown', totalQuota: 'Unknown' }),
    ];

    expect(computeOverageSummary(users, processed).totalOverageRequests).toBe(900);
    expect(computeOverageSummaryFromProcessedData(processed).totalOverageRequests).toBe(900);
  });

  it('keeps the artifact shims overage export aligned with the canonical implementation', () => {
    const users: UserSummary[] = [
      { user: 'test-user-one', totalRequests: 340, modelBreakdown: { 'test-model': 340 } },
      { user: 'test-user-two', totalRequests: 1010, modelBreakdown: { 'test-model': 1010 } },
    ];
    const processed = [
      makeProcessed({ user: 'test-user-one', quotaValue: PRICING.BUSINESS_QUOTA }),
      makeProcessed({ user: 'test-user-two', quotaValue: PRICING.ENTERPRISE_QUOTA }),
    ];

    expect(computeOverageSummaryShim(users, processed)).toEqual(computeOverageSummary(users, processed));
  });
});
