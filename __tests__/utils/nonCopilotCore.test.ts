import {
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  normalizeRow,
  QuotaAggregator,
  UsageAggregator,
  analyzeCodeReviewAdoptionFromArtifacts,
  deriveAnalysisFromArtifacts,
} from '@/utils/ingestion';
import { AggregatorContext } from '@/utils/ingestion/types';
import { PRICING } from '@/constants/pricing';

describe('non-Copilot Code Review core support', () => {
  const ctx: AggregatorContext = { pricing: PRICING };

  test('normalizeRow accepts blank username only for Code Review and forces zero quota', () => {
    const warnings: string[] = [];

    const special = normalizeRow({
      date: '2025-10-01',
      username: '',
      model: 'Code Review',
      quantity: '3',
      total_monthly_quota: '1000',
      exceeds_quota: 'false'
    }, warnings);

    const invalid = normalizeRow({
      date: '2025-10-01',
      username: '',
      model: 'gpt-4.1',
      quantity: '3',
      total_monthly_quota: '1000',
      exceeds_quota: 'false'
    }, warnings);

    expect(special).toEqual(expect.objectContaining({
      user: '',
      isNonCopilotUsage: true,
      usageBucket: 'non_copilot_code_review',
      quotaValue: 0,
      quotaRaw: '0'
    }));
    expect(invalid).toBeNull();
    expect(warnings).toContain('Blank username is only allowed for Code Review usage date=2025-10-01');
  });

  test('aggregators exclude non-Copilot rows from user analytics but retain aggregate totals', () => {
    const usage = new UsageAggregator();
    const quota = new QuotaAggregator();
    const daily = new DailyBucketsAggregator();
    const feature = new FeatureUsageAggregator();
    usage.init?.(ctx);
    quota.init?.(ctx);
    daily.init?.(ctx);
    feature.init?.(ctx);

    const rows = [
      normalizeRow({
        date: '2025-10-01',
        username: '',
        model: 'Code Review',
        quantity: '3',
        total_monthly_quota: '1000',
        exceeds_quota: 'false'
      }, [])!,
      normalizeRow({
        date: '2025-10-02',
        username: 'alice',
        model: 'gpt-4.1',
        quantity: '5',
        total_monthly_quota: '300',
        exceeds_quota: 'false'
      }, [])!,
      normalizeRow({
        date: '2025-10-03',
        username: 'alice',
        model: 'Code Review',
        quantity: '2',
        total_monthly_quota: '300',
        exceeds_quota: 'false'
      }, [])!
    ];

    for (const row of rows) {
      usage.onRow(row, ctx);
      quota.onRow(row, ctx);
      daily.onRow(row, ctx);
      feature.onRow(row, ctx);
    }

    const usageOut = usage.finalize(ctx);
    const quotaOut = quota.finalize(ctx);
    const dailyOut = daily.finalize(ctx);
    const featureOut = feature.finalize(ctx);
    const analysis = deriveAnalysisFromArtifacts(usageOut, quotaOut, dailyOut);
    const adoption = analyzeCodeReviewAdoptionFromArtifacts(usageOut, quotaOut);

    expect(usageOut.users.map(user => user.user)).toEqual(['alice']);
    expect(usageOut.specialBuckets).toEqual([
      expect.objectContaining({ key: 'non_copilot_code_review', totalRequests: 3, quotaValue: 0 })
    ]);
    expect(quotaOut.quotaByUser.get('alice')).toBe(300);
    expect(quotaOut.specialBucketQuotas?.get('non_copilot_code_review')).toBe(0);
    expect(dailyOut.dailyUserTotals.get('2025-10-01')).toBeUndefined();
    expect(dailyOut.dailyBucketTotals?.get('2025-10-01')?.get('non_copilot_code_review')).toBe(3);
    expect(featureOut.featureTotals.codeReview).toBe(5);
    expect(featureOut.featureUsers.codeReview.size).toBe(1);
    expect(analysis.totalUniqueUsers).toBe(1);
    expect(adoption.totalUniqueUsers).toBe(1);
    expect(adoption.totalUsers).toBe(1);
    expect(adoption.totalCodeReviewRequests).toBe(5);
    expect(adoption.users[0]).toMatchObject({
      user: 'Non-Copilot Users',
      quota: 0,
      codeReviewRequests: 3,
    });
    expect(adoption.users[1].quota).toBe(300);
  });
});
