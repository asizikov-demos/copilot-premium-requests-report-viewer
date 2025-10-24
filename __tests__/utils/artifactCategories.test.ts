import { buildConsumptionCategoriesFromArtifacts } from '@/utils/ingestion/analytics';
import { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion/types';

function makeArtifacts(users: Array<{ user: string; total: number; quota: number | 'unlimited'; models?: Record<string, number> }>): { usage: UsageArtifacts; quota: QuotaArtifacts } {
  const usage: UsageArtifacts = {
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
  const quotaByUser = new Map<string, number | 'unlimited'>();
  users.forEach(u => quotaByUser.set(u.user, u.quota));
  const quota: QuotaArtifacts = {
    quotaByUser,
    conflicts: new Map(),
    distinctQuotas: new Set(users.filter(u=> typeof u.quota === 'number').map(u=> u.quota as number)),
    hasMixedQuotas: true,
    hasMixedLicenses: false
  };
  return { usage, quota };
}

describe('buildConsumptionCategoriesFromArtifacts', () => {
  it('categorizes users according to thresholds', () => {
    const { usage, quota } = makeArtifacts([
      { user: 'power', total: 90, quota: 100 }, // 90%
      { user: 'average', total: 60, quota: 100 }, // 60%
      { user: 'low', total: 10, quota: 100 }, // 10%
      { user: 'unlimited', total: 500, quota: 'unlimited' }
    ]);
    const categories = buildConsumptionCategoriesFromArtifacts(usage, quota);
    expect(categories.powerUsers.map(u=>u.user)).toContain('power');
    expect(categories.averageUsers.map(u=>u.user)).toContain('average');
    expect(categories.lowAdoptionUsers.map(u=>u.user)).toContain('low');
    // unlimited user should have pct 0
    const unlimited = [...categories.lowAdoptionUsers, ...categories.averageUsers, ...categories.powerUsers].find(u=> u.user==='unlimited');
    expect(unlimited?.consumptionPercentage).toBe(0);
  });
});
