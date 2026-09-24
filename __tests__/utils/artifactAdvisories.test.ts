import { PRICING } from '@/constants/pricing';
import { buildConsumptionCategoriesFromArtifacts, buildAdvisoriesFromArtifacts, WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';

import { makeUsageArtifacts, makeQuotaArtifacts } from '../helpers/makeArtifacts';

describe('buildAdvisoriesFromArtifacts', () => {
  it('produces training advisory when low adoption threshold met', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: 5 },
      { user: 'test-user-two', totalCredits: 5 },
      { user: 'test-user-three', totalCredits: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-four', totalCredits: 5 },
      { user: 'test-user-five', totalCredits: 5 }
    ]);
    const quota = makeQuotaArtifacts([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-four', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-five', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const weekly: WeeklyQuotaExhaustionBreakdown = { totalUsersExhausted: 0, weeks: [] };
    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);
    expect(advisories.find(a => a.type === 'training')).toBeTruthy();
  });

  it('uses week 1-4 exhaustion counts for AI-credit spending budget advisories', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', totalCredits: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', totalCredits: 10 },
      { user: 'test-user-four', totalCredits: 10 },
      { user: 'test-user-five', totalCredits: 10 }
    ]);
    const quota = makeQuotaArtifacts([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-four', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-five', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }
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
    const budgetAdvisory = advisories.find(advisory => advisory.type === 'spendingBudget');

    expect(budgetAdvisory).toMatchObject({
      affectedUsers: 2,
      severity: 'high'
    });
    expect(budgetAdvisory?.description).toContain('2 users (40%)');
  });

  it('does not approximate early exhausters from power users when only week 5 exhaustion exists', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', totalCredits: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', totalCredits: 10 }
    ]);
    const quota = makeQuotaArtifacts([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const weekly: WeeklyQuotaExhaustionBreakdown = {
      totalUsersExhausted: 2,
      weeks: [
        { weekNumber: 5, startDate: '2025-06-29', endDate: '2025-06-30', usersExhaustedInWeek: 2 }
      ]
    };

    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);

    expect(advisories.find(advisory => advisory.type === 'spendingBudget')).toBeUndefined();
  });
});
