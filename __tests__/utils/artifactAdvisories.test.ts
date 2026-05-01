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

function makeQuota(entries: Array<{ user: string; quota: number | 'unlimited' }>): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unlimited'>();
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
  it('uses weekly exhaustion counts directly for per-request billing advisories', () => {
    const usage = makeUsage([
      { user: 'test-user-one', total: 10 },
      { user: 'test-user-two', total: 10 },
      { user: 'test-user-three', total: 10 },
      { user: 'test-user-four', total: 10 },
      { user: 'test-user-five', total: 10 }
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: 100 },
      { user: 'test-user-two', quota: 100 },
      { user: 'test-user-three', quota: 100 },
      { user: 'test-user-four', quota: 100 },
      { user: 'test-user-five', quota: 100 }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const weekly: WeeklyQuotaExhaustionBreakdown = {
      totalUsersExhausted: 3,
      weeks: [
        { weekNumber: 2, startDate: '2025-06-08', endDate: '2025-06-14', usersExhaustedInWeek: 2 },
        { weekNumber: 5, startDate: '2025-06-29', endDate: '2025-06-30', usersExhaustedInWeek: 1 }
      ]
    };

    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);
    const perRequest = advisories.find(a => a.type === 'perRequestBilling');
    expect(perRequest).toMatchObject({
      severity: 'high',
      affectedUsers: 2,
      description: expect.stringContaining('2 users (40%)')
    });
    expect(perRequest?.description).not.toContain('3 users');
  });

  it('produces training advisory when low adoption threshold met', () => {
    const usage = makeUsage([
      { user: 'u1', total: 5 },
      { user: 'u2', total: 5 },
      { user: 'u3', total: 90 },
      { user: 'u4', total: 5 },
      { user: 'u5', total: 5 }
    ]);
    const quota = makeQuota([
      { user: 'u1', quota: 100 },
      { user: 'u2', quota: 100 },
      { user: 'u3', quota: 100 },
      { user: 'u4', quota: 100 },
      { user: 'u5', quota: 100 }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const weekly: WeeklyQuotaExhaustionBreakdown = { totalUsersExhausted: 0, weeks: [] };
    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);
    expect(advisories.find(a => a.type === 'training')).toBeTruthy();
  });
});
