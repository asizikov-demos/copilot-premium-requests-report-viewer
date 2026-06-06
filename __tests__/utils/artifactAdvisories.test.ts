import { buildConsumptionCategoriesFromArtifacts, buildAdvisoriesFromArtifacts, WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';
import { makeUsageArtifacts, makeQuotaArtifacts } from '../helpers/makeArtifacts';

describe('buildAdvisoriesFromArtifacts', () => {
  it('produces training advisory when low adoption threshold met', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalRequests: 5 },
      { user: 'test-user-two', totalRequests: 5 },
      { user: 'test-user-three', totalRequests: 90 },
      { user: 'test-user-four', totalRequests: 5 },
      { user: 'test-user-five', totalRequests: 5 }
    ]);
    const quota = makeQuotaArtifacts([
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
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalRequests: 300 },
      { user: 'test-user-two', totalRequests: 300 },
      { user: 'test-user-three', totalRequests: 10 },
      { user: 'test-user-four', totalRequests: 10 },
      { user: 'test-user-five', totalRequests: 10 }
    ]);
    const quota = makeQuotaArtifacts([
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
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalRequests: 300 },
      { user: 'test-user-two', totalRequests: 300 },
      { user: 'test-user-three', totalRequests: 10 }
    ]);
    const quota = makeQuotaArtifacts([
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
