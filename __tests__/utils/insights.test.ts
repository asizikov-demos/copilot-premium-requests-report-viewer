import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import { categorizeUserConsumption, classifyConsumptionUser, CONSUMPTION_THRESHOLDS } from '@/utils/analytics/insights';
import { buildFeatureUtilizationFromArtifacts } from '@/utils/ingestion/analytics';
import type { FeatureUsageArtifacts } from '@/utils/ingestion/types';

import { makeProcessedData } from '../helpers/testUtils';

function makeFeatureUsageArtifacts({
  codeReview = 0,
  codingAgent = 0,
  spark = 0,
  codeQuality = 0,
  unattributedCodeReview = 0,
  unattributedCodeQuality = 0,
  codeReviewUsers = [],
  codingAgentUsers = [],
  sparkUsers = [],
  codeQualityUsers = []
}: {
  codeReview?: number;
  codingAgent?: number;
  spark?: number;
  codeQuality?: number;
  unattributedCodeReview?: number;
  unattributedCodeQuality?: number;
  codeReviewUsers?: string[];
  codingAgentUsers?: string[];
  sparkUsers?: string[];
  codeQualityUsers?: string[];
}): FeatureUsageArtifacts {
  return {
    featureTotals: {
      codeReview,
      codingAgent,
      spark,
      codeQuality
    },
    featureUsers: {
      codeReview: new Set(codeReviewUsers),
      codingAgent: new Set(codingAgentUsers),
      spark: new Set(sparkUsers),
      codeQuality: new Set(codeQualityUsers)
    },
    specialTotals: {
      unattributedCodeReview,
      unattributedCodeQuality
    }
  };
}

describe('insights analytics', () => {
  test('classifyConsumptionUser handles quota and threshold categories', () => {
    const quota = 100;

    expect(classifyConsumptionUser(50, 'unknown')).toEqual({ consumptionPercentage: 0, category: 'unknown' });
    expect(classifyConsumptionUser(50, 0)).toEqual({ consumptionPercentage: 0, category: 'unknown' });

    const belowAvg = classifyConsumptionUser((CONSUMPTION_THRESHOLDS.averageMinPct - 0.1) / 100 * quota, quota);
    expect(belowAvg.consumptionPercentage).toBeCloseTo(CONSUMPTION_THRESHOLDS.averageMinPct - 0.1, 6);
    expect(belowAvg.category).toBe('low');

    const avgEdge = classifyConsumptionUser((CONSUMPTION_THRESHOLDS.averageMinPct / 100) * quota, quota);
    expect(avgEdge.consumptionPercentage).toBeCloseTo(CONSUMPTION_THRESHOLDS.averageMinPct, 6);
    expect(avgEdge.category).toBe('average');

    const powerEdge = classifyConsumptionUser((CONSUMPTION_THRESHOLDS.powerMinPct / 100) * quota, quota);
    expect(powerEdge.consumptionPercentage).toBeCloseTo(CONSUMPTION_THRESHOLDS.powerMinPct, 6);
    expect(powerEdge.category).toBe('power');
  });

  test('categorizeUserConsumption threshold boundaries', () => {
    const quota = PRICING.BUSINESS_AI_CREDIT_QUOTA;
    const users: UserSummary[] = [
      { user: 'test-user-low-edge-below', totalCredits: (CONSUMPTION_THRESHOLDS.averageMinPct - 0.1) / 100 * quota, modelBreakdown: {} },
      { user: 'test-user-average-edge', totalCredits: (CONSUMPTION_THRESHOLDS.averageMinPct) / 100 * quota, modelBreakdown: {} },
      { user: 'test-user-average-high', totalCredits: (CONSUMPTION_THRESHOLDS.powerMinPct - 0.1) / 100 * quota, modelBreakdown: {} },
      { user: 'test-user-power-edge', totalCredits: (CONSUMPTION_THRESHOLDS.powerMinPct) / 100 * quota, modelBreakdown: {} }
    ];
    const processed: ProcessedData[] = users.map(u => makeProcessedData({ user: u.user, quotaValue: quota }));
    const categorized = categorizeUserConsumption(users, processed);
    const byUser = Object.fromEntries([
      ...categorized.lowAdoptionUsers.map(u => [u.user, u.category]),
      ...categorized.averageUsers.map(u => [u.user, u.category]),
      ...categorized.powerUsers.map(u => [u.user, u.category])
    ]);
    expect(byUser['test-user-low-edge-below']).toBe('low');
    expect(byUser['test-user-average-edge']).toBe('average');
    expect(byUser['test-user-average-high']).toBe('average');
    expect(byUser['test-user-power-edge']).toBe('power');
  });

  test('feature utilization counts AI credits and users from artifacts', () => {
    const stats = buildFeatureUtilizationFromArtifacts(makeFeatureUsageArtifacts({
      codeReview: 9,
      codingAgent: 9,
      spark: 8,
      codeQuality: 51.28584,
      unattributedCodeReview: 4,
      codeReviewUsers: ['test-user-one', 'test-user-two'],
      codingAgentUsers: ['test-user-one', 'test-user-three'],
      sparkUsers: ['test-user-two', 'test-user-four'],
      codeQualityUsers: ['test-user-five']
    }));

    expect(stats.codeReview.totalCredits).toBe(9);
    expect(stats.codeReview.userCount).toBe(2);
    expect(stats.codeReview.averagePerUser).toBe(2.5);
    expect(stats.codingAgent.totalCredits).toBe(9);
    expect(stats.codingAgent.userCount).toBe(2);
    expect(stats.spark.totalCredits).toBe(8);
    expect(stats.spark.userCount).toBe(2);
    expect(stats.codeQuality.totalCredits).toBe(51.28584);
    expect(stats.codeQuality.userCount).toBe(1);
    expect(stats.codeQuality.averagePerUser).toBe(51.28584);
  });

  test('feature utilization excludes unattributed Code Quality credits from the per-user average', () => {
    const stats = buildFeatureUtilizationFromArtifacts(makeFeatureUsageArtifacts({
      codeQuality: 61.28584,
      unattributedCodeQuality: 10,
      codeQualityUsers: ['test-user-five']
    }));

    expect(stats.codeQuality.totalCredits).toBe(61.28584);
    expect(stats.codeQuality.userCount).toBe(1);
    expect(stats.codeQuality.averagePerUser).toBe(51.28584);
  });

  test('feature utilization uses spark totals and users from artifacts', () => {
    const stats = buildFeatureUtilizationFromArtifacts(makeFeatureUsageArtifacts({
      spark: 5,
      sparkUsers: ['test-user-one', 'test-user-two']
    }));

    expect(stats.spark.totalCredits).toBe(5);
    expect(stats.spark.userCount).toBe(2);
  });
});
