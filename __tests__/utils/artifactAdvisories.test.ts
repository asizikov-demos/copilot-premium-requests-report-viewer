import { buildConsumptionCategoriesFromArtifacts, buildAdvisoriesFromArtifacts, WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';
import { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion/types';

function makeUsage(users: Array<{ user: string; total: number; models?: Record<string, number> }>): UsageArtifacts {
  return {
    users: users.map(u => ({
      user: u.user,
      totalRequests: u.total,
      modelBreakdown: u.models || { 'model-a': u.total },
      topModel: 'model-a',
      topModelValue: u.total
    })),
    modelTotals: { 'model-a': users.reduce((s,u)=> s+u.total,0) },
    userCount: users.length,
    modelCount: 1
  };
}

function makeQuota(entries: Array<{ user: string; quota: number | 'unknown' }>): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unknown'>();
  entries.forEach(e => quotaByUser.set(e.user, e.quota));
  return {
    quotaByUser,
    conflicts: new Map(),
    distinctQuotas: new Set(entries.filter(e => typeof e.quota === 'number').map(e => e.quota as number)),
    hasMixedQuotas: true,
    hasMixedLicenses: false
  };
}

describe('buildAdvisoriesFromArtifacts', () => {
  it('produces training advisory when low adoption threshold met', () => {
    const usage = makeUsage([
      { user: 'test-user-one', total: 5 },
      { user: 'test-user-two', total: 5 },
      { user: 'test-user-three', total: 90 },
      { user: 'test-user-four', total: 5 },
      { user: 'test-user-five', total: 5 }
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: 100 },
      { user: 'test-user-two', quota: 100 },
      { user: 'test-user-three', quota: 100 },
      { user: 'test-user-four', quota: 100 },
      { user: 'test-user-five', quota: 100 }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const weekly: WeeklyQuotaExhaustionBreakdown = { totalUsersExhausted: 0, weeks: [] };
    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);
    expect(advisories.find(a => a.type === 'training')).toBeTruthy();
  });

  it('uses week 1-4 exhaustion counts for per-request billing advisories', () => {
    const usage = makeUsage([
      { user: 'test-user-one', total: 300 },
      { user: 'test-user-two', total: 300 },
      { user: 'test-user-three', total: 10 },
      { user: 'test-user-four', total: 10 },
      { user: 'test-user-five', total: 10 }
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: 300 },
      { user: 'test-user-two', quota: 300 },
      { user: 'test-user-three', quota: 300 },
      { user: 'test-user-four', quota: 300 },
      { user: 'test-user-five', quota: 300 }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const weekly: WeeklyQuotaExhaustionBreakdown = {
      totalUsersExhausted: 3,
      weeks: [
        { weekNumber: 1, startDate: '2025-06-01', endDate: '2025-06-07', usersExhaustedInWeek: 1 },
        { weekNumber: 4, startDate: '2025-06-22', endDate: '2025-06-28', usersExhaustedInWeek: 1 },
        { weekNumber: 5, startDate: '2025-06-29', endDate: '2025-06-30', usersExhaustedInWeek: 1 }
      ]
    };

    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);
    const perRequestAdvisory = advisories.find(advisory => advisory.type === 'perRequestBilling');

    expect(perRequestAdvisory).toMatchObject({
      affectedUsers: 2,
      severity: 'high'
    });
    expect(perRequestAdvisory?.description).toContain('2 users (40%)');
  });

  it('does not approximate early exhausters from power users when only week 5 exhaustion exists', () => {
    const usage = makeUsage([
      { user: 'test-user-one', total: 300 },
      { user: 'test-user-two', total: 300 },
      { user: 'test-user-three', total: 10 }
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: 300 },
      { user: 'test-user-two', quota: 300 },
      { user: 'test-user-three', quota: 300 }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const weekly: WeeklyQuotaExhaustionBreakdown = {
      totalUsersExhausted: 2,
      weeks: [
        { weekNumber: 5, startDate: '2025-06-29', endDate: '2025-06-30', usersExhaustedInWeek: 2 }
      ]
    };

    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);

    expect(advisories.find(advisory => advisory.type === 'perRequestBilling')).toBeUndefined();
  });
});
