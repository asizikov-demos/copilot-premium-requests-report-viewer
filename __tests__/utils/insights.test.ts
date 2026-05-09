import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import { categorizeUserConsumption, calculateUnusedValue, CONSUMPTION_THRESHOLDS } from '@/utils/analytics/insights';
import type { UserConsumptionCategory } from '@/utils/analytics/insights';
import { buildFeatureUtilizationFromArtifacts } from '@/utils/ingestion/analytics';
import type { FeatureUsageArtifacts } from '@/utils/ingestion/types';

function makeProcessed(row: Partial<ProcessedData>): ProcessedData {
  const timestamp = row.timestamp || new Date('2025-06-01T00:00:00Z');
  const iso = timestamp.toISOString();
  return {
    timestamp: timestamp as Date,
    user: row.user || 'test-user-default',
    model: row.model || 'o3-mini',
    requestsUsed: row.requestsUsed ?? 0,
    exceedsQuota: row.exceedsQuota ?? false,
    totalQuota: row.totalQuota || '300',
    quotaValue: row.quotaValue ?? 300,
    iso,
    dateKey: iso.slice(0, 10),
    monthKey: iso.slice(0, 7),
    epoch: (timestamp as Date).getTime(),
    isNonCopilotUsage: row.isNonCopilotUsage,
    usageBucket: row.usageBucket,
    product: row.product,
    sku: row.sku,
  } as ProcessedData;
}

function makeFeatureUsageArtifacts({
  codeReview = 0,
  codingAgent = 0,
  spark = 0,
  nonCopilotCodeReview = 0,
  codeReviewUsers = [],
  codingAgentUsers = [],
  sparkUsers = []
}: {
  codeReview?: number;
  codingAgent?: number;
  spark?: number;
  nonCopilotCodeReview?: number;
  codeReviewUsers?: string[];
  codingAgentUsers?: string[];
  sparkUsers?: string[];
}): FeatureUsageArtifacts {
  return {
    featureTotals: {
      codeReview,
      codingAgent,
      spark
    },
    featureUsers: {
      codeReview: new Set(codeReviewUsers),
      codingAgent: new Set(codingAgentUsers),
      spark: new Set(sparkUsers)
    },
    specialTotals: {
      nonCopilotCodeReview
    }
  };
}

describe('insights analytics', () => {
  test('categorizeUserConsumption threshold boundaries', () => {
    const quota = 300;
    const users: UserSummary[] = [
      { user: 'test-user-low-edge-below', totalRequests: (CONSUMPTION_THRESHOLDS.averageMinPct - 0.1) / 100 * quota, modelBreakdown: {} },
      { user: 'test-user-average-edge', totalRequests: (CONSUMPTION_THRESHOLDS.averageMinPct) / 100 * quota, modelBreakdown: {} },
      { user: 'test-user-average-high', totalRequests: (CONSUMPTION_THRESHOLDS.powerMinPct - 0.1) / 100 * quota, modelBreakdown: {} },
      { user: 'test-user-power-edge', totalRequests: (CONSUMPTION_THRESHOLDS.powerMinPct) / 100 * quota, modelBreakdown: {} }
    ];
    const processed: ProcessedData[] = users.map(u => makeProcessed({ user: u.user, quotaValue: quota }));
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

  test('calculateUnusedValue sums unused correctly', () => {
    const users: UserConsumptionCategory[] = [
      { user: 'test-user-one', totalRequests: 100, quota: 300, consumptionPercentage: 33.33, category: 'low' },
      { user: 'test-user-two', totalRequests: 250, quota: 300, consumptionPercentage: 83.33, category: 'average' },
      { user: 'test-user-three', totalRequests: 500, quota: 'unknown', consumptionPercentage: 0, category: 'low' }
    ];
    const total = calculateUnusedValue(users);
    // unused: a=200, b=50 => 250 * overage rate (import pricing constant to avoid magic number).
    expect(total).toBeCloseTo((200 + 50) * PRICING.OVERAGE_RATE_PER_REQUEST, 6);
  });

  test('feature utilization counts sessions & users from artifacts', () => {
    const stats = buildFeatureUtilizationFromArtifacts(makeFeatureUsageArtifacts({
      codeReview: 9,
      codingAgent: 9,
      spark: 8,
      nonCopilotCodeReview: 4,
      codeReviewUsers: ['test-user-one', 'test-user-two'],
      codingAgentUsers: ['test-user-one', 'test-user-three'],
      sparkUsers: ['test-user-two', 'test-user-four']
    }));

    expect(stats.codeReview.totalSessions).toBe(5);
    expect(stats.codeReview.userCount).toBe(2);
    expect(stats.nonCopilotCodeReview.totalSessions).toBe(4);
    expect(stats.codingAgent.totalSessions).toBe(9);
    expect(stats.codingAgent.userCount).toBe(2);
    expect(stats.spark.totalSessions).toBe(8);
    expect(stats.spark.userCount).toBe(2);
  });

  test('feature utilization uses spark totals and users from artifacts', () => {
    const stats = buildFeatureUtilizationFromArtifacts(makeFeatureUsageArtifacts({
      spark: 5,
      sparkUsers: ['test-user-one', 'test-user-two']
    }));

    expect(stats.spark.totalSessions).toBe(5);
    expect(stats.spark.userCount).toBe(2);
  });
});
