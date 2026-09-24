import { PRICING } from '@/constants/pricing';
import { analyzeCodeReviewAdoptionFromArtifacts } from '@/utils/ingestion';
import { makeUsageArtifacts, makeQuotaArtifacts } from '../helpers/makeArtifacts';

function makeQuota(entries: Array<[string, number | 'unknown']>) {
  return makeQuotaArtifacts(entries.map(([user, quota]) => ({ user, quota })));
}

describe('analyzeCodeReviewAdoptionFromArtifacts', () => {
  test('computes adoption rate, total AI credits, and sorts users by review credits', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: 20, modelBreakdown: { 'code review v1': 5, 'gpt-4o': 15 } },
      { user: 'test-user-two', totalCredits: 10, modelBreakdown: { 'Code Review beta': 8, 'o3-mini': 2 } },
      { user: 'test-user-three', totalCredits: 5, modelBreakdown: { 'gpt-4o': 5 } },
    ]);
    const quota = makeQuota([['test-user-one', 'unknown'], ['test-user-two', PRICING.BUSINESS_AI_CREDIT_QUOTA], ['test-user-three', PRICING.ENTERPRISE_AI_CREDIT_QUOTA]]);

    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(2); // test-user-one + test-user-two
    expect(result.totalUniqueUsers).toBe(3);
    expect(result.totalCodeReviewCredits).toBe(13); // 5 + 8
    expect(result.adoptionRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    // Sorted descending by review AI credits: test-user-two (8), test-user-one (5)
    expect(result.users[0].user).toBe('test-user-two');
    expect(result.users[0].codeReviewCredits).toBe(8);
    expect(result.users[0].quota).toBe(PRICING.BUSINESS_AI_CREDIT_QUOTA);
    expect(result.users[1].user).toBe('test-user-one');
    expect(result.users[1].codeReviewCredits).toBe(5);
    expect(result.users[1].quota).toBe('unknown');
  });

  test('returns empty result when no users exist', () => {
    const usage = makeUsageArtifacts([]);
    const quota = makeQuota([]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(0);
    expect(result.totalUniqueUsers).toBe(0);
    expect(result.totalCodeReviewCredits).toBe(0);
    expect(result.adoptionRate).toBe(0);
    expect(result.users).toEqual([]);
  });

  test('returns zero adoption when no users have code review models', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'gpt-4o': 10 } },
    ]);
    const quota = makeQuota([['test-user-one', 'unknown']]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(0);
    expect(result.adoptionRate).toBe(0);
    expect(result.users).toEqual([]);
  });

  test('handles user with zero totalCredits without NaN', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: 0, modelBreakdown: { 'code review v1': 0 } },
    ]);
    const quota = makeQuota([['test-user-one', 'unknown']]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    // User has code review model but 0 AI credits — still counted as adopter
    // but percentage must be 0 (not NaN/Infinity)
    if (result.users.length > 0) {
      expect(Number.isFinite(result.users[0].codeReviewPercentage)).toBe(true);
      expect(result.users[0].codeReviewPercentage).toBe(0);
    }
  });

  test('defaults quota to unknown when user missing from quota map', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'code review v1': 3 } },
    ]);
    const quota = makeQuota([]); // no entries
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.users[0].quota).toBe('unknown');
  });

  test('matches code review models case-insensitively', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'CODE REVIEW Ultra': 4, 'code review lite': 2 } },
    ]);
    const quota = makeQuota([['test-user-one', PRICING.ENTERPRISE_AI_CREDIT_QUOTA]]);
    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.users[0].codeReviewCredits).toBe(6);
    expect(result.users[0].models).toEqual(expect.arrayContaining(['CODE REVIEW Ultra', 'code review lite']));
  });

  test('excludes unattributed review credits from named-user adoption', () => {
    const usage = makeUsageArtifacts([
      { user: 'test-user-one', totalCredits: 20, modelBreakdown: { 'code review v1': 5, 'gpt-4o': 15 } },
      { user: 'test-user-two', totalCredits: 10, modelBreakdown: { 'Code Review beta': 8, 'o3-mini': 2 } },
      { user: 'test-user-three', totalCredits: 5, modelBreakdown: { 'gpt-4o': 5 } },
    ]);
    usage.specialBuckets = [
      {
        key: 'unattributed_ai_credit',
        label: 'Unattributed AI Credits',
        totalCredits: 4,
        modelBreakdown: { 'Code Review beta': 4 },
        quotaValue: 0,
      },
    ];
    const quota = makeQuota([['test-user-one', 'unknown'], ['test-user-two', PRICING.BUSINESS_AI_CREDIT_QUOTA], ['test-user-three', PRICING.ENTERPRISE_AI_CREDIT_QUOTA]]);
    quota.specialBucketQuotas = new Map([['unattributed_ai_credit', 0]]);

    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(2);
    expect(result.totalUniqueUsers).toBe(3);
    expect(result.adoptionRate).toBeCloseTo(66.67, 1);
    expect(result.totalCodeReviewCredits).toBe(13);
    expect(result.users.map((user) => user.user)).toEqual(['test-user-two', 'test-user-one']);
  });

  test('does not synthesize a user when all review credits are unattributed', () => {
    const usage = makeUsageArtifacts([]);
    usage.specialBuckets = [
      {
        key: 'unattributed_ai_credit',
        label: 'Unattributed AI Credits',
        totalCredits: 6,
        modelBreakdown: { 'CODE REVIEW Ultra': 6 },
        quotaValue: 0,
      },
    ];
    const quota = makeQuota([]);
    quota.specialBucketQuotas = new Map([['unattributed_ai_credit', 0]]);

    const result = analyzeCodeReviewAdoptionFromArtifacts(usage, quota);

    expect(result.totalUsers).toBe(0);
    expect(result.totalUniqueUsers).toBe(0);
    expect(result.adoptionRate).toBe(0);
    expect(result.totalCodeReviewCredits).toBe(0);
    expect(result.users).toEqual([]);
  });
});
