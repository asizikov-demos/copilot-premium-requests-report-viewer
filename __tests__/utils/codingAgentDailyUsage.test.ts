import { computeDailyCodingAgentUsage } from '@/utils/analytics/codingAgent';
import { ProcessedData } from '@/types/csv';

describe('computeDailyCodingAgentUsage', () => {
  const base: Omit<ProcessedData, 'requestsUsed' | 'exceedsQuota' | 'totalQuota'> & { requestsUsed?: number } = {
    timestamp: new Date('2025-06-01T10:00:00Z'),
    user: 'u1',
    model: 'coding agent v1',
    quotaValue: 300,
    totalQuota: '300',
    exceedsQuota: false,
    requestsUsed: 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  test('returns empty array for no coding agent usage', () => {
    const data: ProcessedData[] = [
      { ...base, model: 'o3-mini', requestsUsed: 5 }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;
    expect(computeDailyCodingAgentUsage(data)).toEqual([]);
  });

  test('aggregates and computes cumulative with stable UTC dates', () => {
    const data: ProcessedData[] = [
      { ...base, timestamp: new Date('2025-06-01T00:05:00Z'), requestsUsed: 2 },
      { ...base, timestamp: new Date('2025-06-01T23:59:59Z'), requestsUsed: 3 },
      { ...base, timestamp: new Date('2025-06-02T01:00:00Z'), requestsUsed: 5 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;
    const result = computeDailyCodingAgentUsage(data);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2025-06-01', dailyRequests: 5, cumulativeRequests: 5 });
    expect(result[1]).toEqual({ date: '2025-06-02', dailyRequests: 5, cumulativeRequests: 10 });
  });
});
