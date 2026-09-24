import { PRICING } from '@/constants/pricing';
import {
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  normalizeRow,
  QuotaAggregator,
  UsageAggregator,
  analyzeCodeReviewAdoptionFromArtifacts,
  deriveAnalysisFromArtifacts,
} from '@/utils/ingestion';

const ctx = { pricing: PRICING };
const base = {
  date: '2026-07-01',
  model: 'Code Review',
  quantity: '3',
  sku: 'copilot_ai_credit',
  unit_type: 'ai-credits',
  total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
};

describe('unattributed AI-credit usage', () => {
  it('accepts blank usernames on AI-credit rows but rejects request units', () => {
    const warnings: string[] = [];
    expect(normalizeRow({ ...base, username: '' }, warnings)).toMatchObject({
      user: '',
      quantity: 3,
      isUnattributedUsage: true,
      usageBucket: 'unattributed_ai_credit',
      quotaValue: 0,
      quotaRaw: '0',
    });
    expect(normalizeRow({
      ...base,
      username: '',
      sku: 'copilot_premium_request',
      unit_type: 'requests',
    }, warnings)).toBeNull();
    expect(warnings).toEqual([expect.stringContaining('Unsupported usage unit')]);
  });

  it('keeps unattributed Code Review credits and tokens out of named-user quotas', () => {
    const rows = [
      normalizeRow({ ...base, username: '', input: '100' }, [])!,
      normalizeRow({
        ...base,
        date: '2026-07-02',
        username: 'test-user-one',
        model: 'test-model',
        quantity: '5',
      }, [])!,
      normalizeRow({
        ...base,
        date: '2026-07-03',
        username: 'test-user-one',
        quantity: '2',
      }, [])!,
    ];
    const usage = new UsageAggregator();
    const quota = new QuotaAggregator();
    const daily = new DailyBucketsAggregator();
    const feature = new FeatureUsageAggregator();
    for (const row of rows) {
      usage.onRow(row, ctx);
      quota.onRow(row, ctx);
      daily.onRow(row, ctx);
      feature.onRow(row, ctx);
    }
    const usageOut = usage.finalize(ctx);
    const quotaOut = quota.finalize(ctx);
    const dailyOut = daily.finalize(ctx);
    const analysis = deriveAnalysisFromArtifacts(usageOut, quotaOut, dailyOut);
    const adoption = analyzeCodeReviewAdoptionFromArtifacts(usageOut, quotaOut);

    expect(usageOut.users.map(user => user.user)).toEqual(['test-user-one']);
    expect(usageOut.specialBuckets).toEqual([
      expect.objectContaining({ key: 'unattributed_ai_credit', totalCredits: 3, quotaValue: 0 }),
    ]);
    expect(quotaOut.quotaByUser.get('test-user-one')).toBe(PRICING.BUSINESS_AI_CREDIT_QUOTA);
    expect(dailyOut.dailyUserTotals.get('2026-07-01')).toBeUndefined();
    expect(dailyOut.dailyBucketTotals?.get('2026-07-01')?.get('unattributed_ai_credit')).toBe(3);
    expect(feature.finalize(ctx).specialTotals.unattributedCodeReview).toBe(3);
    expect(analysis.totalUniqueUsers).toBe(1);
    expect(adoption.totalUniqueUsers).toBe(1);
    expect(adoption.totalCodeReviewCredits).toBe(2);
  });
});
