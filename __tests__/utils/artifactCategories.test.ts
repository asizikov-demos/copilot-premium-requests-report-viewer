import { PRICING } from '@/constants/pricing';
import { buildConsumptionCategoriesFromArtifacts } from '@/utils/ingestion/analytics';
import { makeUsageArtifacts, makeQuotaArtifacts } from '../helpers/makeArtifacts';

function makeArtifacts(users: Array<{ user: string; total: number; quota: number | 'unknown'; models?: Record<string, number> }>) {
  const usage = makeUsageArtifacts(
    users.map(u => ({ user: u.user, totalCredits: u.total, modelBreakdown: u.models }))
  );
  const quota = makeQuotaArtifacts(users.map(u => ({ user: u.user, quota: u.quota })));
  return { usage, quota };
}

describe('buildConsumptionCategoriesFromArtifacts', () => {
  it('categorizes users according to thresholds', () => {
    const { usage, quota } = makeArtifacts([
      { user: 'test-user-one', total: PRICING.BUSINESS_AI_CREDIT_QUOTA * .9, quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', total: PRICING.BUSINESS_AI_CREDIT_QUOTA * .6, quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', total: PRICING.BUSINESS_AI_CREDIT_QUOTA * .1, quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-four', total: 500, quota: 'unknown' }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    expect(categories.powerUsers.map(u=>u.user)).toContain('test-user-one');
    expect(categories.averageUsers.map(u=>u.user)).toContain('test-user-two');
    expect(categories.lowAdoptionUsers.map(u=>u.user)).toContain('test-user-three');
    expect([...categories.lowAdoptionUsers, ...categories.averageUsers, ...categories.powerUsers]
      .map(u => u.user)).not.toContain('test-user-four');
  });
});
