import { PRICING } from '@/constants/pricing';
import {
  BillingAggregator,
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  getArtifactContractIssues,
  hasValidArtifactContract,
  ingestStream,
  QuotaAggregator,
  TokenAggregator,
  UsageAggregator,
  type DailyBucketsArtifacts,
  type IngestionResult,
  type QuotaArtifacts,
  type UsageArtifacts
} from '@/utils/ingestion';

describe('artifact contract validation', () => {
  function makeValidOutputs() {
    const quota: QuotaArtifacts = {
      quotaByUser: new Map<string, number | 'unknown'>([['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA]]),
      conflicts: new Map<string, Set<number | 'unknown'>>(),
      distinctQuotas: new Set([PRICING.BUSINESS_AI_CREDIT_QUOTA]),
      hasMixedQuotas: false,
      hasMixedLicenses: false,
      specialBucketQuotas: new Map([['unattributed_ai_credit', 0 as const]])
    };

    const usage: UsageArtifacts = {
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

    const dailyBuckets: DailyBucketsArtifacts = {
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

  test('accepts historical quota tiers recorded in conflicts', () => {
    const outputs = makeValidOutputs();
    outputs.quota.quotaByUser.set('test-user-one', PRICING.ENTERPRISE_AI_CREDIT_QUOTA);
    outputs.quota.conflicts.set('test-user-one', new Set([PRICING.BUSINESS_AI_CREDIT_QUOTA, PRICING.ENTERPRISE_AI_CREDIT_QUOTA]));
    outputs.quota.distinctQuotas = new Set([PRICING.BUSINESS_AI_CREDIT_QUOTA, PRICING.ENTERPRISE_AI_CREDIT_QUOTA]);

    expect(getArtifactContractIssues(outputs)).toEqual([]);
  });

  test('tolerates fractional rounding drift proportional to totals', () => {
    const outputs = makeValidOutputs();
    let userTotal = 0;
    let codeReview = 0;
    let codingAgent = 0;
    for (let i = 0; i < 100_000; i++) {
      userTotal += 0.1;
      if (i % 2 === 0) codeReview += 0.1; else codingAgent += 0.1;
    }
    outputs.usage.users[0].totalCredits = userTotal;
    outputs.usage.users[0].modelBreakdown = { 'Code Review model': codeReview, 'Coding Agent model': codingAgent };
    outputs.usage.modelTotals = { 'Code Review model': codeReview, 'Coding Agent model': codingAgent };
    outputs.dailyBuckets.dailyUserTotals = new Map([['2026-06-01', new Map([['test-user-one', userTotal]])]]);
    outputs.dailyBuckets.dailyUserModelTotals = new Map([
      ['2026-06-01', new Map([['test-user-one', new Map([['Code Review model', codeReview], ['Coding Agent model', codingAgent]])]])]
    ]);

    expect(userTotal).not.toBe(codeReview + codingAgent);
    expect(getArtifactContractIssues(outputs)).toEqual([]);
  });

  test('flags a month list that omits months containing daily data', () => {
    const outputs = makeValidOutputs();
    outputs.dailyBuckets.months = ['2026-07'];

    expect(getArtifactContractIssues(outputs)).toContain(
      'dailyBuckets artifact month list is missing daily data for 2026-06'
    );
  });

  test('flags drift when a day is missing from dailyUserModelTotals', () => {
    const outputs = makeValidOutputs();
    outputs.dailyBuckets.dailyUserModelTotals = new Map();

    expect(getArtifactContractIssues(outputs)).toContain(
      'dailyBuckets artifact drifts for 2026-06-01/test-user-one between dailyUserTotals and dailyUserModelTotals'
    );
  });

  test('flags usage users missing required totals', () => {
    const outputs = makeValidOutputs();
    const { usage } = outputs;
    (usage as unknown as { users: unknown[] }).users = [{ user: 'test-user-one' }];
    usage.modelTotals = {};

    expect(getArtifactContractIssues(outputs)).toContain(
      'usage artifact for test-user-one is missing a valid modelBreakdown'
    );
  });

  test.each([
    ['dailyBuckets', 'dailyBuckets artifact has an invalid shape', (outputs: Record<string, Record<string, unknown>>) => {
      outputs.dailyBuckets.dailyUserModelTotals = new Map([['2026-06-01', {}]]);
    }],
    ['billing', 'billing artifact has an invalid shape', (outputs: Record<string, Record<string, unknown>>) => {
      outputs.billing.totals = {};
    }],
    ['tokens without byDay', 'tokens artifact has an invalid shape', (outputs: Record<string, Record<string, unknown>>) => {
      delete outputs.tokens.byDay;
    }],
    ['tokens without reportedRows', 'tokens artifact has an invalid shape', (outputs: Record<string, Record<string, unknown>>) => {
      outputs.tokens.totals = { rowCount: 1 };
    }]
  ])('reports malformed %s artifacts as invalid shape', (_label, expectedIssue, mutate) => {
    const outputs = makeValidOutputs() as unknown as Record<string, Record<string, unknown>>;
    mutate(outputs);

    expect(() => getArtifactContractIssues(outputs)).not.toThrow();
    expect(getArtifactContractIssues(outputs)).toContain(expectedIssue);
  });

  test('accepts artifacts produced by the streaming aggregators', async () => {
    const csv = [
      'date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,total_monthly_quota,organization,repository,cost_center_name,aic_quantity,aic_gross_amount,input,output,cache_read,cache_write',
      `2026-06-01,test-user-one,copilot,copilot_ai_credit,Code Review model,2.5,ai-credits,0.01,0.025,0.025,0,${PRICING.BUSINESS_AI_CREDIT_QUOTA},test-org-one,,test-cost-center-one,2.5,0.025,100,50,1000,0`,
      `2026-06-15,test-user-one,copilot,copilot_ai_credit,Coding Agent model,0.3,ai-credits,0.01,0.003,0,0.003,${PRICING.ENTERPRISE_AI_CREDIT_QUOTA},test-org-one,,test-cost-center-one,0.3,0.003,10,5,0,0`,
      `2026-07-02,test-user-two,copilot,copilot_ai_credit,Code Review model,0.7,ai-credits,0.01,0.007,0,0.007,${PRICING.BUSINESS_AI_CREDIT_QUOTA},test-org-one,,test-cost-center-one,0.7,0.007,20,10,0,0`
    ].join('\n');
    const file = new File([csv], 'test-usage.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: csv.length });
    Object.defineProperty(file, 'slice', { value: (start = 0, end = csv.length) => ({ content: csv.slice(start, end) }) });

    class MockFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null;
      readAsText(chunk: { content: string }): void {
        this.onload?.({ target: { result: chunk.content } });
      }
    }
    const originalFileReader = globalThis.FileReader;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    try {
      const result = await new Promise<IngestionResult>((resolve, reject) => {
        ingestStream(file, [
          new QuotaAggregator(),
          new UsageAggregator(),
          new DailyBucketsAggregator(),
          new FeatureUsageAggregator(),
          new BillingAggregator(),
          new TokenAggregator()
        ], { onComplete: resolve, onError: reject });
      });

      expect(getArtifactContractIssues(result.outputs)).toEqual([]);
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });
});
