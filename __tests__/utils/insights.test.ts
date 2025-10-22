import { categorizeUserConsumption, calculateUnusedValue, CONSUMPTION_THRESHOLDS, UserConsumptionCategory, calculateFeatureUtilization } from '@/utils/analytics/insights';
import { ProcessedData } from '@/types/csv';
import { UserSummary } from '@/utils/analytics';

function makeProcessed(row: Partial<ProcessedData>): ProcessedData {
  return {
    timestamp: row.timestamp || new Date('2025-06-01T00:00:00Z'),
    user: row.user || 'u',
    model: row.model || 'o3-mini',
    requestsUsed: row.requestsUsed ?? 0,
    exceedsQuota: row.exceedsQuota ?? false,
    totalQuota: row.totalQuota || '300',
    quotaValue: row.quotaValue ?? 300
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PRICING } = require('@/constants/pricing');
    expect(total).toBeCloseTo((200 + 50) * PRICING.OVERAGE_RATE_PER_REQUEST, 6);
  });

  test('feature utilization counts sessions & users', () => {
    const data: ProcessedData[] = [
      makeProcessed({ user: 'u1', model: 'Code Review', requestsUsed: 3 }),
      makeProcessed({ user: 'u2', model: 'code review', requestsUsed: 2 }),
      makeProcessed({ user: 'u1', model: 'Coding Agent', requestsUsed: 5 }),
      makeProcessed({ user: 'u3', model: 'Padawan', requestsUsed: 4 }),
      makeProcessed({ user: 'u2', model: 'Spark', requestsUsed: 7 }),
      makeProcessed({ user: 'u4', model: 'Spark', requestsUsed: 1 }),
    ];
    const stats = calculateFeatureUtilization(data);
    expect(stats.codeReview.totalSessions).toBe(5);
    expect(stats.codeReview.userCount).toBe(2);
    expect(stats.codingAgent.totalSessions).toBe(9);
    expect(stats.codingAgent.userCount).toBe(2);
    expect(stats.spark.totalSessions).toBe(8);
    expect(stats.spark.userCount).toBe(2);
  });
});
