import { analyzeCodeReviewAdoptionFromArtifacts, UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';

function makeUsage(users: Array<{ user: string; totalRequests: number; modelBreakdown: Record<string, number> }>): UsageArtifacts {
  const modelTotals: Record<string, number> = {};
  for (const u of users) {
    for (const [model, qty] of Object.entries(u.modelBreakdown)) {
      modelTotals[model] = (modelTotals[model] || 0) + qty;
    }
  }
  return { users, modelTotals, userCount: users.length, modelCount: Object.keys(modelTotals).length };
}

function makeQuota(entries: Array<[string, number | 'unlimited']>): QuotaArtifacts {
  return {
    quotaByUser: new Map(entries),
    conflicts: new Map(),
    distinctQuotas: new Set(),
    hasMixedQuotas: false,
    hasMixedLicenses: false,
  };
}

describe('analyzeCodeReviewAdoptionFromArtifacts', () => {
  test('computes adoption rate, total requests, and sorts users by review requests', () => {
    const usage = makeUsage([
      { user: 'alice', totalRequests: 20, modelBreakdown: { 'code review v1': 5, 'gpt-4o': 15 } },
      { user: 'bob', totalRequests: 10, modelBreakdown: { 'Code Review beta': 8, 'o3-mini': 2 } },
      { user: 'carol', totalRequests: 5, modelBreakdown: { 'gpt-4o': 5 } },
    ]);
    const quota = makeQuota([['alice', 'unlimited'], ['bob', 300], ['carol', 1000]]);

    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(2); // alice + bob
    expect(result.totalUniqueUsers).toBe(3);
    expect(result.totalCodeReviewRequests).toBe(13); // 5 + 8
    expect(result.adoptionRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    // Sorted descending by review requests: bob (8), alice (5)
    expect(result.users[0].user).toBe('bob');
    expect(result.users[0].codeReviewRequests).toBe(8);
    expect(result.users[0].quota).toBe(300);
    expect(result.users[1].user).toBe('alice');
    expect(result.users[1].codeReviewRequests).toBe(5);
    expect(result.users[1].quota).toBe('unlimited');
  });

  test('returns empty result when no users exist', () => {
    const usage = makeUsage([]);
    const quota = makeQuota([]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(0);
    expect(result.totalUniqueUsers).toBe(0);
    expect(result.totalCodeReviewRequests).toBe(0);
    expect(result.adoptionRate).toBe(0);
    expect(result.users).toEqual([]);
  });

  test('returns zero adoption when no users have code review models', () => {
    const usage = makeUsage([
      { user: 'alice', totalRequests: 10, modelBreakdown: { 'gpt-4o': 10 } },
    ]);
    const quota = makeQuota([['alice', 'unlimited']]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(0);
    expect(result.adoptionRate).toBe(0);
    expect(result.users).toEqual([]);
  });

  test('handles user with zero totalRequests without NaN', () => {
    const usage = makeUsage([
      { user: 'alice', totalRequests: 0, modelBreakdown: { 'code review v1': 0 } },
    ]);
    const quota = makeQuota([['alice', 'unlimited']]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    // User has code review model but 0 requests — still counted as adopter
    // but percentage must be 0 (not NaN/Infinity)
    if (result.users.length > 0) {
      expect(Number.isFinite(result.users[0].codeReviewPercentage)).toBe(true);
      expect(result.users[0].codeReviewPercentage).toBe(0);
    }
  });

  test('defaults quota to unlimited when user missing from quota map', () => {
    const usage = makeUsage([
      { user: 'alice', totalRequests: 10, modelBreakdown: { 'code review v1': 3 } },
    ]);
    const quota = makeQuota([]); // no entries
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.users[0].quota).toBe('unlimited');
  });

  test('matches code review models case-insensitively', () => {
    const usage = makeUsage([
      { user: 'alice', totalRequests: 10, modelBreakdown: { 'CODE REVIEW Ultra': 4, 'code review lite': 2 } },
    ]);
    const quota = makeQuota([['alice', 1000]]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.users[0].codeReviewRequests).toBe(6);
    expect(result.users[0].models).toEqual(expect.arrayContaining(['CODE REVIEW Ultra', 'code review lite']));
  });

  test('includes non-Copilot review bucket as synthetic table row without affecting adoption denominator', () => {
    const usage = makeUsage([
      { user: 'alice', totalRequests: 20, modelBreakdown: { 'code review v1': 5, 'gpt-4o': 15 } },
      { user: 'bob', totalRequests: 10, modelBreakdown: { 'Code Review beta': 8, 'o3-mini': 2 } },
      { user: 'carol', totalRequests: 5, modelBreakdown: { 'gpt-4o': 5 } },
    ]);
    usage.specialBuckets = [
      {
        key: 'non_copilot_code_review',
        label: 'Non-Copilot users',
        totalRequests: 4,
        modelBreakdown: { 'Code Review beta': 4 },
        quotaValue: 0,
      },
    ];
    const quota = makeQuota([['alice', 'unlimited'], ['bob', 300], ['carol', 1000]]);
    quota.specialBucketQuotas = new Map([['non_copilot_code_review', 0]]);

    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(2);
    expect(result.totalUniqueUsers).toBe(3);
    expect(result.adoptionRate).toBeCloseTo(66.67, 1);
    expect(result.totalCodeReviewRequests).toBe(17);
    expect(result.users.map((user) => user.user)).toEqual(['bob', 'alice', 'Non-Copilot Users']);
    expect(result.users[2]).toMatchObject({
      user: 'Non-Copilot Users',
      codeReviewRequests: 4,
      totalRequests: 4,
      quota: 0,
      codeReviewPercentage: 100,
      isSyntheticNonCopilotRow: true,
    });
  });

  test('returns synthetic non-Copilot row when it is the only code review usage', () => {
    const usage = makeUsage([]);
    usage.specialBuckets = [
      {
        key: 'non_copilot_code_review',
        label: 'Non-Copilot users',
        totalRequests: 6,
        modelBreakdown: { 'CODE REVIEW Ultra': 6 },
        quotaValue: 0,
      },
    ];
    const quota = makeQuota([]);
    quota.specialBucketQuotas = new Map([['non_copilot_code_review', 0]]);

    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(0);
    expect(result.totalUniqueUsers).toBe(0);
    expect(result.adoptionRate).toBe(0);
    expect(result.totalCodeReviewRequests).toBe(6);
    expect(result.users).toEqual([
      {
        user: 'Non-Copilot Users',
        totalRequests: 6,
        codeReviewRequests: 6,
        codeReviewPercentage: 100,
        quota: 0,
        models: ['CODE REVIEW Ultra'],
        isSyntheticNonCopilotRow: true,
      },
    ]);
  });
});
