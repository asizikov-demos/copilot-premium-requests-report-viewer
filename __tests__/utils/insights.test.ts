import { PRICING } from '@/constants/pricing';
import { categorizeUserConsumption, calculateUnusedValue, CONSUMPTION_THRESHOLDS, UserConsumptionCategory } from '@/utils/analytics/insights';
import { ProcessedData } from '@/types/csv';
import { buildFeatureUtilizationFromArtifacts } from '@/utils/ingestion/analytics';
import { FeatureUsageArtifacts } from '@/utils/ingestion/types';
import { UserSummary } from '@/utils/analytics';

function makeProcessed(row: Partial<ProcessedData>): ProcessedData {
  const timestamp = row.timestamp || new Date('2025-06-01T00:00:00Z');
  const iso = timestamp.toISOString();
  return {
    timestamp: timestamp as Date,
    user: row.user || 'u',
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

function makeFeatureUsageArtifacts(overrides?: Partial<FeatureUsageArtifacts>): FeatureUsageArtifacts {
  return {
    featureTotals: {
      codeReview: 0,
      codingAgent: 0,
      spark: 0,
      ...overrides?.featureTotals
    },
    featureUsers: {
      codeReview: new Set<string>(),
      codingAgent: new Set<string>(),
      spark: new Set<string>(),
      ...overrides?.featureUsers
    },
    specialTotals: {
      nonCopilotCodeReview: 0,
      ...overrides?.specialTotals
    }
  };
}

describe('insights analytics', () => {
  test('categorizeUserConsumption threshold boundaries', () => {
    const quota = 300;
    const users: UserSummary[] = [
      { user: 'lowEdgeBelow', totalRequests: (CONSUMPTION_THRESHOLDS.averageMinPct - 0.1) / 100 * quota, modelBreakdown: {} },
      { user: 'avgEdge', totalRequests: (CONSUMPTION_THRESHOLDS.averageMinPct) / 100 * quota, modelBreakdown: {} },
      { user: 'avgHigh', totalRequests: (CONSUMPTION_THRESHOLDS.powerMinPct - 0.1) / 100 * quota, modelBreakdown: {} },
      { user: 'powerEdge', totalRequests: (CONSUMPTION_THRESHOLDS.powerMinPct) / 100 * quota, modelBreakdown: {} }
    ];
    const processed: ProcessedData[] = users.map(u => makeProcessed({ user: u.user, quotaValue: quota }));
    const categorized = categorizeUserConsumption(users, processed);
    const byUser = Object.fromEntries([
      ...categorized.lowAdoptionUsers.map(u => [u.user, u.category]),
      ...categorized.averageUsers.map(u => [u.user, u.category]),
      ...categorized.powerUsers.map(u => [u.user, u.category])
    ]);
    expect(byUser.lowEdgeBelow).toBe('low');
    expect(byUser.avgEdge).toBe('average');
    expect(byUser.avgHigh).toBe('average');
    expect(byUser.powerEdge).toBe('power');
  });

  test('calculateUnusedValue sums unused correctly', () => {
    const users: UserConsumptionCategory[] = [
      { user: 'a', totalRequests: 100, quota: 300, consumptionPercentage: 33.33, category: 'low' },
      { user: 'b', totalRequests: 250, quota: 300, consumptionPercentage: 83.33, category: 'average' },
      { user: 'c', totalRequests: 500, quota: 'unlimited', consumptionPercentage: 0, category: 'low' }
    ];
    const total = calculateUnusedValue(users);
    // unused: a=200, b=50 => 250 * overage rate (import pricing constant to avoid magic number).
    expect(total).toBeCloseTo((200 + 50) * PRICING.OVERAGE_RATE_PER_REQUEST, 6);
  });

  test('feature utilization counts sessions & users', () => {
    const stats = buildFeatureUtilizationFromArtifacts(makeFeatureUsageArtifacts({
      featureTotals: {
        codeReview: 9,
        codingAgent: 9,
        spark: 8
      },
      featureUsers: {
        codeReview: new Set(['test-user-one', 'test-user-two']),
        codingAgent: new Set(['test-user-one', 'test-user-three']),
        spark: new Set(['test-user-two', 'test-user-four'])
      },
      specialTotals: {
        nonCopilotCodeReview: 4
      }
    }));

    expect(stats.codeReview.totalSessions).toBe(5);
    expect(stats.codeReview.userCount).toBe(2);
    expect(stats.nonCopilotCodeReview.totalSessions).toBe(4);
    expect(stats.codingAgent.totalSessions).toBe(9);
    expect(stats.codingAgent.userCount).toBe(2);
    expect(stats.spark.totalSessions).toBe(8);
    expect(stats.spark.userCount).toBe(2);
  });

  test('feature utilization uses aggregated spark totals and distinct users', () => {
    const stats = buildFeatureUtilizationFromArtifacts(makeFeatureUsageArtifacts({
      featureTotals: {
        spark: 5
      },
      featureUsers: {
        spark: new Set(['test-user-one', 'test-user-two'])
      }
    }));

    expect(stats.spark.totalSessions).toBe(5);
    expect(stats.spark.userCount).toBe(2);
  });
});
