import { PRICING } from '@/constants/pricing';
import {
  buildQuotaArtifactsFromProcessedData,
  buildUsageArtifactsFromProcessedData,
} from '@/utils/ingestion';
import { buildUsersExceedingQuota } from '@/utils/ingestion/analytics';
import { calculateExcessCredits } from '@/utils/userCalculations';

import { makeDailyBucketsArtifacts, makeQuotaArtifacts } from '../helpers/makeArtifacts';
import { makeProcessedData } from '../helpers/testUtils';

describe('AI-credit quota excess', () => {
  it('returns zero within quota, preserves fractional excess, and ignores unknown quotas', () => {
    expect(calculateExcessCredits(PRICING.BUSINESS_AI_CREDIT_QUOTA, PRICING.BUSINESS_AI_CREDIT_QUOTA)).toBe(0);
    expect(calculateExcessCredits(PRICING.BUSINESS_AI_CREDIT_QUOTA + 12.5, PRICING.BUSINESS_AI_CREDIT_QUOTA)).toBeCloseTo(12.5);
    expect(calculateExcessCredits(PRICING.ENTERPRISE_AI_CREDIT_QUOTA + 25, PRICING.ENTERPRISE_AI_CREDIT_QUOTA)).toBe(25);
    expect(calculateExcessCredits(5000, 'unknown')).toBe(0);
  });

  it('does not combine usage from separate UTC billing months to infer quota exhaustion', () => {
    const quotaValue = PRICING.BUSINESS_AI_CREDIT_QUOTA;
    const daily = makeDailyBucketsArtifacts([
      { date: '2026-06-30', user: 'test-user-one', used: quotaValue - 1 },
      { date: '2026-07-01', user: 'test-user-one', used: quotaValue - 1 },
    ]);
    const quota = makeQuotaArtifacts([{ user: 'test-user-one', quota: quotaValue }]);
    expect(buildUsersExceedingQuota(daily, quota)).toBe(0);
  });

  it('counts distinct named users who exceed a known quota in any UTC month', () => {
    const businessQuota = PRICING.BUSINESS_AI_CREDIT_QUOTA;
    const enterpriseQuota = PRICING.ENTERPRISE_AI_CREDIT_QUOTA;
    const daily = makeDailyBucketsArtifacts([
      { date: '2026-06-30', user: 'test-user-one', used: businessQuota },
      { date: '2026-06-30', user: 'test-user-two', used: enterpriseQuota },
      { date: '2026-06-30', user: 'test-user-three', used: enterpriseQuota + 100 },
      { date: '2026-07-01', user: 'test-user-one', used: businessQuota + .5 },
      { date: '2026-07-02', user: 'test-user-one', used: 1 },
      { date: '2026-08-01', user: 'test-user-one', used: businessQuota + 1 },
      { date: '2026-08-01', user: 'test-user-four', used: 10000 },
    ]);
    const quota = makeQuotaArtifacts([
      { user: 'test-user-one', quota: businessQuota },
      { user: 'test-user-two', quota: enterpriseQuota },
      { user: 'test-user-three', quota: enterpriseQuota },
      { user: 'test-user-four', quota: 'unknown' },
    ]);
    expect(buildUsersExceedingQuota(daily, quota)).toBe(2);
  });

  it('resolves conflicting quotas to the highest recognized AI-credit tier', () => {
    const rows = [
      makeProcessedData({ user: 'test-user-one', creditsUsed: 2000, quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA }),
      makeProcessedData({ user: 'test-user-one', creditsUsed: 50, quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA }),
    ];
    const quota = buildQuotaArtifactsFromProcessedData(rows);
    const usage = buildUsageArtifactsFromProcessedData(rows);
    expect(quota.quotaByUser.get('test-user-one')).toBe(PRICING.ENTERPRISE_AI_CREDIT_QUOTA);
    expect(calculateExcessCredits(usage.users[0].totalCredits, quota.quotaByUser.get('test-user-one')!)).toBe(0);
  });
});
