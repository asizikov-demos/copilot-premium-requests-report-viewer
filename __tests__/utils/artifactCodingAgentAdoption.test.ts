import { analyzeCodingAgentAdoptionFromArtifacts } from '@/utils/ingestion';

import { makeQuotaArtifacts, makeUsageArtifacts } from '../helpers/makeArtifacts';

function makeQuota(entries: Array<[string, number | 'unknown']>) {
  return makeQuotaArtifacts(entries.map(([user, quota]) => ({ user, quota })));
}

describe('analyzeCodingAgentAdoptionFromArtifacts', () => {
  test('computes adoption rate, totals, quota, percentages, and sorts users by coding agent requests', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalRequests: 20, modelBreakdown: { 'coding agent v1': 5, 'gpt-4o': 15 } },
      { user: 'test-user-two', totalRequests: 10, modelBreakdown: { 'Copilot Coding Agent beta': 8, 'o3-mini': 2 } },
      { user: 'test-user-three', totalRequests: 5, modelBreakdown: { 'gpt-4o': 5 } },
    ]);
    const quota = makeQuota([
      ['test-user-one', 'unknown'],
      ['test-user-two', 300],
      ['test-user-three', 1000],
    ]);

    const result = analyzeCodingAgentAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(2);
    expect(result.totalUniqueUsers).toBe(3);
    expect(result.totalCodingAgentRequests).toBe(13);
    expect(result.adoptionRate).toBeCloseTo(66.67, 1);
    expect(result.users).toMatchObject([
      {
        user: 'test-user-two',
        totalRequests: 10,
        codingAgentRequests: 8,
        codingAgentPercentage: 80,
        quota: 300,
        models: ['Copilot Coding Agent beta'],
      },
      {
        user: 'test-user-one',
        totalRequests: 20,
        codingAgentRequests: 5,
        codingAgentPercentage: 25,
        quota: 'unknown',
        models: ['coding agent v1'],
      },
    ]);
  });

  test('avoids NaN percentage when a coding agent model has zero requests', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalRequests: 0, modelBreakdown: { 'coding agent v1': 0 } },
    ]);
    const quota = makeQuota([]);

    const result = analyzeCodingAgentAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(1);
    expect(result.totalCodingAgentRequests).toBe(0);
    expect(result.users[0]).toMatchObject({
      user: 'test-user-one',
      codingAgentRequests: 0,
      codingAgentPercentage: 0,
      quota: 'unknown',
    });
    expect(Number.isFinite(result.users[0].codingAgentPercentage)).toBe(true);
  });
});
