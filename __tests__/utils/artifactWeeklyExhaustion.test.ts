import { PRICING } from '@/constants/pricing';
import { computeWeeklyQuotaExhaustionFromArtifacts } from '@/utils/ingestion/analytics';

import { makeDailyBucketsArtifacts as makeDailyBuckets, makeQuotaArtifacts as makeQuota } from '../helpers/makeArtifacts';

describe('computeWeeklyQuotaExhaustionFromArtifacts', () => {
  it('returns empty structure for no daily data', () => {
    const daily = makeDailyBuckets([]);
    const quota = makeQuota([]);
    const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
    expect(result).toEqual({ totalUsersExhausted: 0, weeks: [] });
  });

  it('computes week buckets and first exhaustion correctly (single month)', () => {
    const businessQuota = PRICING.BUSINESS_AI_CREDIT_QUOTA;
    const daily = makeDailyBuckets([
      { date: '2025-06-01', user: 'test-user-two', used: businessQuota / 2 },
      { date: '2025-06-03', user: 'test-user-one', used: businessQuota / 2 },
      { date: '2025-06-05', user: 'test-user-three', used: 500 },
      { date: '2025-06-07', user: 'test-user-two', used: businessQuota / 2 },
      { date: '2025-06-08', user: 'test-user-one', used: businessQuota / 4 },
      { date: '2025-06-10', user: 'test-user-one', used: businessQuota / 4 },
      { date: '2025-06-22', user: 'test-user-four', used: businessQuota - 10 },
      { date: '2025-06-29', user: 'test-user-four', used: 11 }
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: businessQuota },
      { user: 'test-user-two', quota: businessQuota },
      { user: 'test-user-three', quota: 'unknown' },
      { user: 'test-user-four', quota: businessQuota }
    ]);
    const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
    expect(result.totalUsersExhausted).toBe(3);
    const weeks = result.weeks;
    const w1 = weeks.find(w => w.weekNumber === 1);
    const w2 = weeks.find(w => w.weekNumber === 2);
    const w5 = weeks.find(w => w.weekNumber === 5);
    expect(w1?.usersExhaustedInWeek).toBe(1);
    expect(w2?.usersExhaustedInWeek).toBe(1);
    expect(w5?.usersExhaustedInWeek).toBe(1);
  });

  it('does not double count users across later activity', () => {
    // Later usage does not change the first exhaustion week.
    const daily = makeDailyBuckets([
      { date: '2025-06-15', user: 'test-user-one', used: PRICING.BUSINESS_AI_CREDIT_QUOTA - 100 },
      { date: '2025-06-18', user: 'test-user-one', used: 120 },
      { date: '2025-06-25', user: 'test-user-one', used: 50 }
    ]);
    const quota = makeQuota([{ user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }]);
    const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
    expect(result.totalUsersExhausted).toBe(1);
    const w3 = result.weeks.find(w => w.weekNumber === 3);
    expect(w3?.usersExhaustedInWeek).toBe(1);
    expect(result.weeks.length).toBe(1);
  });

  it('handles multiple months producing ordered week entries', () => {
    // June week1 exhaustion + July week2 exhaustion
    const daily = makeDailyBuckets([
      { date: '2025-06-05', user: 'test-user-one', used: PRICING.BUSINESS_AI_CREDIT_QUOTA + 100 },
      { date: '2025-07-09', user: 'test-user-two', used: PRICING.BUSINESS_AI_CREDIT_QUOTA + 100 }
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }
    ]);
    const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
    expect(result.totalUsersExhausted).toBe(2);
    expect(result.weeks[0].weekNumber).toBe(1);
    expect(result.weeks[1].weekNumber).toBe(2);
  });

  it('resets cumulative credits at the UTC month boundary before deciding exhaustion', () => {
    const quotaValue = PRICING.BUSINESS_AI_CREDIT_QUOTA;
    const daily = makeDailyBuckets([
      { date: '2026-06-30', user: 'test-user-one', used: quotaValue - 1 },
      { date: '2026-07-01', user: 'test-user-one', used: 1 },
      { date: '2026-07-08', user: 'test-user-one', used: quotaValue - 1 },
    ]);
    const quota = makeQuota([{ user: 'test-user-one', quota: quotaValue }]);

    expect(computeWeeklyQuotaExhaustionFromArtifacts(daily, quota)).toEqual({
      totalUsersExhausted: 1,
      weeks: [
        { weekNumber: 2, startDate: '2026-07-08', endDate: '2026-07-14', usersExhaustedInWeek: 1 },
      ],
    });
  });
});
