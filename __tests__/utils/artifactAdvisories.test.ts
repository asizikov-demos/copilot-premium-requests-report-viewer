import { PRICING } from '@/constants/pricing';
import { buildAdvisoriesFromCategories } from '@/utils/analytics/advisory';
import { buildConsumptionCategoriesFromArtifacts } from '@/utils/ingestion/analytics';

import { makeUsageArtifacts, makeQuotaArtifacts } from '../helpers/makeArtifacts';

describe('buildAdvisoriesFromCategories', () => {
  it.each([0, 1, 2, 5])('preserves the 40%% adoption advisory threshold with %i low-consumption users', lowCount => {
    const users = Array.from({ length: 5 }, (_, index) => ({
      user: `test-user-${index}`,
      totalCredits: PRICING.BUSINESS_AI_CREDIT_QUOTA * (index < lowCount ? 0.3 : 0.6),
    }));
    const usage = makeUsageArtifacts(users);
    const quota = makeQuotaArtifacts(users.map(user => ({ user: user.user, quota: PRICING.BUSINESS_AI_CREDIT_QUOTA })));
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    const advisories = buildAdvisoriesFromCategories(categories.lowAdoptionUsers, usage.userCount);

    expect(advisories).toHaveLength(lowCount >= 2 ? 1 : 0);
    if (lowCount >= 2) {
      expect(advisories[0]).toMatchObject({ type: 'training', affectedUsers: lowCount });
      expect(advisories[0].description).toContain('less than 45%');
    }

  });

  it('has no adoption recommendations for empty or unknown-quota data', () => {
    const usage = makeUsageArtifacts([{ user: 'test-user-one', totalCredits: 1 }]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, makeQuotaArtifacts([]));
    expect(buildAdvisoriesFromCategories(categories.lowAdoptionUsers, usage.userCount)).toEqual([]);
    expect(buildAdvisoriesFromCategories([], 0)).toEqual([]);
  });
});
