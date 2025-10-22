import { buildConsumptionCategoriesFromArtifacts, buildAdvisoriesFromArtifacts } from '@/utils/ingestion/analytics';
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
    const weekly = { totalUsersExhausted: 0, weeks: [] } as any;
    const advisories = buildAdvisoriesFromArtifacts(categories, weekly, usage, quota);
    expect(advisories.find(a => a.type === 'training')).toBeTruthy();
  });
});
