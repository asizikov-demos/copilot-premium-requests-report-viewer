import { computeWeeklyQuotaExhaustionFromArtifacts } from '@/utils/ingestion/analytics';
import type { DailyBucketsArtifacts, QuotaArtifacts } from '@/utils/ingestion';

// Helper to build DailyBucketsArtifacts with daily user totals
function makeDailyBuckets(entries: Array<{ date: string; user: string; used: number }>): DailyBucketsArtifacts {
  const dailyUserTotals = new Map<string, Map<string, number>>();
  let min: string | null = null;
  let max: string | null = null;
  for (const e of entries) {
    if (!dailyUserTotals.has(e.date)) dailyUserTotals.set(e.date, new Map());
    const userMap = dailyUserTotals.get(e.date)!;
    userMap.set(e.user, (userMap.get(e.user) || 0) + e.used);
    if (!min || e.date < min) min = e.date;
    if (!max || e.date > max) max = e.date;
  }
  return {
    dailyUserTotals,
    dateRange: min && max ? { min, max } : null,
    months: Array.from(new Set(Array.from(dailyUserTotals.keys()).map(d => d.slice(0,7)))).sort()
  } as DailyBucketsArtifacts;
}

function makeQuota(quotaEntries: Array<{ user: string; quota: number | 'unlimited' }>): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unlimited'>();
  for (const q of quotaEntries) quotaByUser.set(q.user, q.quota);
  return { quotaByUser } as QuotaArtifacts;
}

describe('computeWeeklyQuotaExhaustionFromArtifacts', () => {
  it('returns empty structure for no daily data', () => {
    const daily = makeDailyBuckets([]);
    const quota = makeQuota([]);
    const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
    expect(result).toEqual({ totalUsersExhausted: 0, weeks: [] });
  });

  it('computes week buckets and first exhaustion correctly (single month)', () => {
    // UserA quota 300: reaches exactly 300 on day 10 (week2) (100+100+100)
    // UserB quota 300: reaches 300 on day 7 (week1) (150+150)
    // UserC unlimited: ignored
    // UserD quota 300: reaches 310 on day 29 (week5)
    const daily = makeDailyBuckets([
      { date: '2025-06-01', user: 'UserB', used: 150 },
      { date: '2025-06-03', user: 'UserA', used: 100 },
      { date: '2025-06-05', user: 'UserC', used: 500 },
      { date: '2025-06-07', user: 'UserB', used: 150 },
      { date: '2025-06-08', user: 'UserA', used: 100 },
      { date: '2025-06-10', user: 'UserA', used: 100 },
      { date: '2025-06-22', user: 'UserD', used: 200 },
      { date: '2025-06-29', user: 'UserD', used: 110 }
    ]);
    const quota = makeQuota([
      { user: 'UserA', quota: 300 },
      { user: 'UserB', quota: 300 },
      { user: 'UserC', quota: 'unlimited' },
      { user: 'UserD', quota: 300 }
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
    // UserA quota 300: hits quota in week3; later activity ignored for exhaustion week
    const daily = makeDailyBuckets([
      { date: '2025-06-15', user: 'UserA', used: 200 },
      { date: '2025-06-18', user: 'UserA', used: 120 }, // cumulative 320 -> week3
      { date: '2025-06-25', user: 'UserA', used: 50 }
    ]);
    const quota = makeQuota([{ user: 'UserA', quota: 300 }]);
    const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
    expect(result.totalUsersExhausted).toBe(1);
    const w3 = result.weeks.find(w => w.weekNumber === 3);
    expect(w3?.usersExhaustedInWeek).toBe(1);
    expect(result.weeks.length).toBe(1);
  });

  it('handles multiple months producing ordered week entries', () => {
    // June week1 exhaustion + July week2 exhaustion
    const daily = makeDailyBuckets([
      { date: '2025-06-05', user: 'UserJ', used: 400 },
      { date: '2025-07-09', user: 'UserK', used: 500 }
    ]);
    const quota = makeQuota([
      { user: 'UserJ', quota: 300 },
      { user: 'UserK', quota: 300 }
    ]);
    const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
    expect(result.totalUsersExhausted).toBe(2);
    expect(result.weeks[0].weekNumber).toBe(1);
    expect(result.weeks[1].weekNumber).toBe(2);
  });
});
