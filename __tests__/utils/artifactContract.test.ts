import { PRICING } from '@/constants/pricing';
import { getArtifactContractIssues, hasValidArtifactContract } from '@/utils/ingestion';

describe('artifact contract validation', () => {
  function makeValidOutputs() {
    const quota = {
      quotaByUser: new Map<string, number | 'unknown'>([['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA]]),
      conflicts: new Map<string, Set<number | 'unknown'>>(),
      distinctQuotas: new Set([PRICING.BUSINESS_AI_CREDIT_QUOTA]),
      hasMixedQuotas: false,
      hasMixedLicenses: false,
      specialBucketQuotas: new Map([['unattributed_ai_credit', 0]])
    };

    const usage = {
      users: [{
        user: 'test-user-one',
        totalCredits: 30,
        modelBreakdown: { 'Code Review model': 20, 'Coding Agent model': 10 },
        quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
        organization: 'test-org-one',
        costCenter: 'test-cost-center-one'
      }],
      modelTotals: { 'Code Review model': 20, 'Coding Agent model': 10 },
      userCount: 1,
      modelCount: 2,
      organizations: ['test-org-one'],
      costCenters: ['test-cost-center-one'],
      specialBuckets: [{
        key: 'unattributed_ai_credit',
        label: 'Unattributed AI Credits',
        totalCredits: 0,
        modelBreakdown: {},
        quotaValue: 0
      }]
    };

    const dailyBuckets = {
      dailyUserTotals: new Map<string, Map<string, number>>([
        ['2026-06-01', new Map([['test-user-one', 30]])]
      ]),
      dateRange: { min: '2026-06-01', max: '2026-06-01' },
      dailyUserModelTotals: new Map<string, Map<string, Map<string, number>>>([
        ['2026-06-01', new Map([[ 'test-user-one', new Map([['Code Review model', 20], ['Coding Agent model', 10]]) ]])]
      ]),
      months: ['2026-06']
    };

    const featureUsage = {
      featureTotals: { codeReview: 20, codingAgent: 10, spark: 0, codeQuality: 0 },
      featureUsers: {
        codeReview: new Set(['test-user-one']),
        codingAgent: new Set(['test-user-one']),
        spark: new Set(),
        codeQuality: new Set()
      },
      specialTotals: { unattributedCodeReview: 0, unattributedCodeQuality: 0 }
    };

    const billing = {
      totals: { gross: 0, discount: 0, net: 0, aicQuantity: 0, aicGrossAmount: 0 },
      users: [{ user: 'test-user-one', quantity: 30, gross: 0, discount: 0, net: 0, quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA }],
      userMap: new Map([['test-user-one', { user: 'test-user-one', quantity: 30, gross: 0, discount: 0, net: 0, quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA }]]),
      orgTotals: new Map(),
      costCenterTotals: new Map(),
      billingByModel: new Map(),
      hasAnyBillingData: false,
      hasAnyAicData: true,
      specialBuckets: []
    };

    const tokens = {
      totals: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheWriteTokens: 5,
        rowCount: 1,
        reportedRows: {
          inputTokens: 1,
          outputTokens: 1,
          cacheReadTokens: 1,
          cacheWriteTokens: 1
        }
      },
      byModel: new Map([['Code Review model', {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheWriteTokens: 5,
        rowCount: 1,
        reportedRows: {
          inputTokens: 1,
          outputTokens: 1,
          cacheReadTokens: 1,
          cacheWriteTokens: 1
        }
      }]]),
      byUser: new Map([['test-user-one', {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheWriteTokens: 5,
        rowCount: 1,
        reportedRows: {
          inputTokens: 1,
          outputTokens: 1,
          cacheReadTokens: 1,
          cacheWriteTokens: 1
        }
      }]]),
      specialBuckets: new Map(),
      hasAnyTokenData: true,
      byDay: new Map([['2026-06-01', {
        totals: {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 10,
          cacheWriteTokens: 5,
          rowCount: 1,
          reportedRows: {
            inputTokens: 1,
            outputTokens: 1,
            cacheReadTokens: 1,
            cacheWriteTokens: 1
          }
        },
        byModel: new Map(),
        byUser: new Map(),
        specialBuckets: new Map()
      }]])
    };

    return { quota, usage, dailyBuckets, featureUsage, billing, tokens };
  }

  test('accepts a complete artifact set without drift', () => {
    const outputs = makeValidOutputs();

    expect(hasValidArtifactContract(outputs)).toBe(true);
    expect(getArtifactContractIssues(outputs)).toEqual([]);
  });

  test('flags usage drift between user totals and model totals', () => {
    const outputs = makeValidOutputs();
    outputs.usage.users[0].totalCredits = 40;
    outputs.usage.modelTotals = { 'Code Review model': 20, 'Coding Agent model': 10 };

    expect(hasValidArtifactContract(outputs)).toBe(false);
    expect(getArtifactContractIssues(outputs)).toContain(
      'usage artifact for test-user-one drifts between modelBreakdown and totalCredits'
    );
  });

  test('accepts multiple users sharing the same quota tier', () => {
    const outputs = makeValidOutputs();
    outputs.quota.quotaByUser.set('test-user-two', PRICING.BUSINESS_AI_CREDIT_QUOTA);
    outputs.quota.distinctQuotas = new Set([PRICING.BUSINESS_AI_CREDIT_QUOTA]);
    outputs.usage.users.push({
      user: 'test-user-two',
      totalCredits: 15,
      modelBreakdown: { 'Coding Agent model': 15 },
      quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one'
    });
    outputs.usage.modelTotals['Coding Agent model'] = 25;

    expect(hasValidArtifactContract(outputs)).toBe(true);
    expect(getArtifactContractIssues(outputs)).toEqual([]);
  });

  test('flags missing month metadata when daily buckets contain data', () => {
    const outputs = makeValidOutputs();
    outputs.dailyBuckets.months = [];

    expect(hasValidArtifactContract(outputs)).toBe(false);
    expect(getArtifactContractIssues(outputs)).toContain(
      'dailyBuckets artifact is missing the canonical month list'
    );
  });

  test('flags daily bucket drift for unattributed usage', () => {
    const outputs = makeValidOutputs();
    outputs.dailyBuckets.dailyBucketTotals = new Map([
      ['2026-06-01', new Map([['unattributed_ai_credit', 10]])]
    ]);
    outputs.dailyBuckets.dailyBucketModelTotals = new Map([
      ['2026-06-01', new Map([['unattributed_ai_credit', new Map([['Code Review model', 7]])]])]
    ]);

    expect(hasValidArtifactContract(outputs)).toBe(false);
    expect(getArtifactContractIssues(outputs)).toContain(
      'dailyBuckets artifact drifts for 2026-06-01/unattributed_ai_credit between dailyBucketTotals and dailyBucketModelTotals'
    );
  });
});
