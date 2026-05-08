import {
  computeWeeklyQuotaExhaustionFromArtifacts
} from '@/utils/ingestion/analytics';
import type { UsageArtifacts, QuotaArtifacts } from '@/utils/ingestion';
import { buildMonthListFromArtifacts } from '@/utils/ingestion/analytics';
import type { DailyBucketsArtifacts } from '@/utils/ingestion';
import { filterBySelectedMonths } from '@/utils/analytics/filters';
import { PRICING } from '@/constants/pricing';
import { CSVData, ProcessedData } from '@/types/csv';

import { processCSVData, analyzeData } from '../helpers/processCSVData';
import { validCSVData, powerUserCSVData } from '../fixtures/validCSVData';
import {
  buildMinimalDailyBucketsArtifact,
  createMockCSVData,
  createMockCSVDataArray
} from '../helpers/testUtils';

// Explicit model requests interface to remove implicit any usage
interface ModelRequest { model: string; totalRequests: number }
const modelTotal = (requests: ModelRequest[], name: string) => requests.find(r => r.model === name)?.totalRequests;
interface WeekExhaustion { weekNumber: number; startDate: string; endDate: string; usersExhaustedInWeek: number }

describe('CSV Data Processing', () => {
  describe('processCSVData', () => {
    it('should correctly process valid CSV data', () => {
      const result = processCSVData(validCSVData);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        timestamp: new Date('2025-06-03T00:00:00Z'),
        user: 'test-user-a',
        model: 'gpt-4.1-2025-04-14',
        requestsUsed: 1.00,
        exceedsQuota: false,
        totalQuota: 'Unlimited',
        quotaValue: 'unlimited'
      });
    });

    it('should handle boolean conversion correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          exceeds_quota: 'TRUE'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].exceedsQuota).toBe(true);
    });

    it('should handle case-insensitive boolean conversion', () => {
      const testData: CSVData[] = [
        createMockCSVData({ exceeds_quota: 'True' }),
        createMockCSVData({ exceeds_quota: 'FALSE' }),
        createMockCSVData({ exceeds_quota: 'false' })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].exceedsQuota).toBe(true);
      expect(result[1].exceedsQuota).toBe(false);
      expect(result[2].exceedsQuota).toBe(false);
    });

    it('should handle numeric conversion correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: '3.14159'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].requestsUsed).toBe(3.14159);
    });

    it('should handle invalid numbers gracefully', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: 'invalid'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].requestsUsed).toBeNaN();
    });

    it('should handle zero values correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: '0'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].requestsUsed).toBe(0);
    });

    it('should use production quota parsing for blank quotas', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          username: 'test-user-one',
          total_monthly_quota: '   '
        })
      ];

      const result = processCSVData(testData);
      expect(result[0].quotaValue).toBe('unlimited');
    });

    it('should handle empty array', () => {
      const result = processCSVData([]);
      expect(result).toEqual([]);
    });

    it('should preserve all user and model information', () => {
      const result = processCSVData(validCSVData);
      
      expect(result[1]).toMatchObject({
        timestamp: new Date('2025-06-03T00:00:00Z'),
        user: 'test-user-b',
        model: 'claude-3.7-sonnet-thought',
        requestsUsed: 2.50,
        exceedsQuota: true,
        totalQuota: '100',
        quotaValue: 100
      });
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = createMockCSVDataArray(1000);
      const start = performance.now();
      const result = processCSVData(largeDataset);
      const end = performance.now();
      
      expect(result).toHaveLength(1000);
      expect(end - start).toBeLessThan(100); // Should process 1000 records in under 100ms
    });
  });

  describe('analyzeData', () => {
    it('should return empty analysis for empty data', () => {
      const result = analyzeData([]);
      
      expect(result).toEqual({
        timeFrame: { start: '', end: '' },
        totalUniqueUsers: 0,
        usersExceedingQuota: 0,
        requestsByModel: [],
        quotaBreakdown: {
          unlimited: [],
          business: [],
          enterprise: [],
          mixed: false,
          suggestedPlan: null
        }
      });
    });

    it('should correctly analyze valid data', () => {
      const processedData = processCSVData(validCSVData);
      const result = analyzeData(processedData);
      
      expect(result.totalUniqueUsers).toBe(3); // test-user-a, test-user-b, test-user-c
      expect(result.usersExceedingQuota).toBe(0); // Nobody actually exceeds their quota (test-user-b: 2.5/100, others unlimited)
      expect(result.requestsByModel).toHaveLength(4); // 4 different models
    });

    it('should calculate correct time frame', () => {
      const processedData = processCSVData(validCSVData);
      const result = analyzeData(processedData);
      
      expect(result.timeFrame.start).toBe('2025-06-03');
      expect(result.timeFrame.end).toBe('2025-06-04');
    });

    it('should aggregate requests by model correctly', () => {
      const processedData = processCSVData(validCSVData);
      const result = analyzeData(processedData) as { requestsByModel: ModelRequest[] };
      expect(modelTotal(result.requestsByModel, 'gpt-4.1-2025-04-14')).toBe(1);
      expect(modelTotal(result.requestsByModel, 'claude-3.7-sonnet-thought')).toBe(2.5);
    });

    it('should handle single data point', () => {
      const singleData = processCSVData([validCSVData[0]]);
      const result = analyzeData(singleData);
      
      expect(result.totalUniqueUsers).toBe(1);
      expect(result.usersExceedingQuota).toBe(0);
      expect(result.requestsByModel).toHaveLength(1);
    });

    it('should sort data by timestamp internally', () => {
      // Create data with mixed dates
      const mixedData: CSVData[] = [
        createMockCSVData({ 
          date: '2025-06-05',
          username: 'User1'
        }),
        createMockCSVData({ 
          date: '2025-06-03',
          username: 'User2'
        }),
        createMockCSVData({ 
          date: '2025-06-04',
          username: 'User3'
        })
      ];
      
      const processedData = processCSVData(mixedData);
      const result = analyzeData(processedData);
      
      expect(result.timeFrame.start).toBe('2025-06-03');
      expect(result.timeFrame.end).toBe('2025-06-05');
    });

    it('should resolve conflicting user quotas before counting quota overages', () => {
      const processedData = processCSVData([
        createMockCSVData({
          username: 'test-user-one',
          quantity: '400',
          total_monthly_quota: String(PRICING.BUSINESS_QUOTA),
        }),
        createMockCSVData({
          username: 'test-user-one',
          quantity: '0',
          total_monthly_quota: String(PRICING.ENTERPRISE_QUOTA),
        }),
        createMockCSVData({
          username: 'test-user-two',
          quantity: '1200',
          total_monthly_quota: String(PRICING.BUSINESS_QUOTA),
        }),
        createMockCSVData({
          username: 'test-user-two',
          quantity: '0',
          total_monthly_quota: 'Unlimited',
        }),
      ]);

      const result = analyzeData(processedData);

      expect(result.usersExceedingQuota).toBe(0);
      expect(result.quotaBreakdown.enterprise).toEqual(['test-user-one']);
      expect(result.quotaBreakdown.unlimited).toEqual(['test-user-two']);
      expect(result.quotaBreakdown.business).toEqual([]);
    });
  });

  // Helper: build minimal UsageArtifacts from processed data for artifact power user tests
  function buildUsageArtifacts(processed: ProcessedData[]): UsageArtifacts {
    const modelTotals: Record<string, number> = {};
    const usersMap = new Map<string, { totalRequests: number; modelBreakdown: Record<string, number> }>();
    for (const row of processed) {
      modelTotals[row.model] = (modelTotals[row.model] || 0) + row.requestsUsed;
      const entry = usersMap.get(row.user) || { totalRequests: 0, modelBreakdown: {} };
      entry.totalRequests += row.requestsUsed;
      entry.modelBreakdown[row.model] = (entry.modelBreakdown[row.model] || 0) + row.requestsUsed;
      usersMap.set(row.user, entry);
    }
    const users = Array.from(usersMap.entries()).map(([user, v]) => {
      let topModel: string | undefined; let topModelValue = 0;
      for (const [m, qty] of Object.entries(v.modelBreakdown)) { if (qty > topModelValue) { topModelValue = qty; topModel = m; } }
      return { user, totalRequests: v.totalRequests, modelBreakdown: v.modelBreakdown, topModel, topModelValue };
    });
    return { users, modelTotals, userCount: users.length, modelCount: Object.keys(modelTotals).length } as UsageArtifacts;
  }

  describe('Date Filtering Functions', () => {
    const createTestDataForDate = (dateString: string): ProcessedData => {
      const timestamp = new Date(dateString);
      const iso = timestamp.toISOString();
      return {
        timestamp,
        user: 'test-user',
        model: 'test-model',
        requestsUsed: 1.0,
        exceedsQuota: false,
        totalQuota: '100',
        quotaValue: 100,
        iso,
        dateKey: iso.substring(0, 10),
        monthKey: iso.substring(0, 7),
        epoch: timestamp.getTime()
      };
    };

    describe('getAvailableMonths (artifact-based)', () => {
      it('should return available months from data', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-07-15T10:00:00Z'),
          createTestDataForDate('2025-06-20T10:00:00Z'),
          createTestDataForDate('2025-08-15T10:00:00Z')
        ];

        const artifacts = buildMinimalDailyBucketsArtifact(data);
        const months = buildMonthListFromArtifacts(artifacts);
        expect(months).toEqual([
          { value: '2025-06', label: 'June 2025' },
          { value: '2025-07', label: 'July 2025' },
          { value: '2025-08', label: 'August 2025' }
        ]);
      });

      it('should return empty array for no data', () => {
        const artifacts = buildMinimalDailyBucketsArtifact([]);
        const months = buildMonthListFromArtifacts(artifacts);
        expect(months).toEqual([]);
      });

      it('should handle single month', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-06-20T10:00:00Z')
        ];

        const artifacts = buildMinimalDailyBucketsArtifact(data);
        const months = buildMonthListFromArtifacts(artifacts);
        expect(months).toEqual([
          { value: '2025-06', label: 'June 2025' }
        ]);
      });
    });

    describe('hasMultipleMonths (artifact-based)', () => {
      it('should return true for data spanning multiple months', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-07-15T10:00:00Z')
        ];

        const artifacts = buildMinimalDailyBucketsArtifact(data);
        const months = buildMonthListFromArtifacts(artifacts);
        expect(months.length > 1).toBe(true);
      });

      it('should return false for data in single month', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-06-20T10:00:00Z')
        ];

        const artifacts = buildMinimalDailyBucketsArtifact(data);
        const months = buildMonthListFromArtifacts(artifacts);
        expect(months.length > 1).toBe(false);
      });

      it('should return false for empty data', () => {
        const artifacts = buildMinimalDailyBucketsArtifact([]);
        const months = buildMonthListFromArtifacts(artifacts);
        expect(months.length > 1).toBe(false);
      });
    });

    describe('filterBySelectedMonths', () => {
      const testData = [
        createTestDataForDate('2025-06-15T10:00:00Z'),
        createTestDataForDate('2025-07-15T10:00:00Z'),
        createTestDataForDate('2025-08-15T10:00:00Z'),
        createTestDataForDate('2025-06-20T10:00:00Z')
      ];

      it('should filter by selected months', () => {
        const filtered = filterBySelectedMonths(testData, ['2025-06', '2025-08']);
        expect(filtered).toHaveLength(3);
        expect(filtered.map(d => d.timestamp.toISOString())).toEqual([
          '2025-06-15T10:00:00.000Z',
          '2025-08-15T10:00:00.000Z',
          '2025-06-20T10:00:00.000Z'
        ]);
      });

      it('should return all data when no months selected', () => {
        const filtered = filterBySelectedMonths(testData, []);
        expect(filtered).toEqual(testData);
      });

      it('should return empty array when no data matches selected months', () => {
        const filtered = filterBySelectedMonths(testData, ['2025-12']);
        expect(filtered).toEqual([]);
      });
    });
  });

  describe('computeWeeklyQuotaExhaustion (artifact-based)', () => {

    const makeProcessed = (entries: Array<{ ts: string; user: string; used: number; quota: number | 'unlimited'; model?: string }>): ProcessedData[] => {
      return entries.map(e => {
        const timestamp = new Date(e.ts);
        const iso = timestamp.toISOString();
        return {
          timestamp,
          user: e.user,
          model: e.model || 'test-model',
          requestsUsed: e.used,
          exceedsQuota: false,
          totalQuota: e.quota === 'unlimited' ? 'Unlimited' : String(e.quota),
          quotaValue: e.quota,
          iso,
          dateKey: iso.substring(0, 10),
          monthKey: iso.substring(0, 7),
          epoch: timestamp.getTime()
        };
      });
    };

    // Helpers to build artifacts for weekly exhaustion tests
    function buildDailyArtifacts(entries: ProcessedData[]): DailyBucketsArtifacts {
      const dailyUserTotals = new Map<string, Map<string, number>>();
      let min: string | null = null; let max: string | null = null;
      for (const row of entries) {
        const day = row.dateKey;
        if (!dailyUserTotals.has(day)) dailyUserTotals.set(day, new Map());
        const userMap = dailyUserTotals.get(day)!;
        userMap.set(row.user, (userMap.get(row.user) || 0) + row.requestsUsed);
        if (!min || day < min) min = day;
        if (!max || day > max) max = day;
      }
      return { dailyUserTotals, dateRange: min && max ? { min, max } : null, months: Array.from(new Set(Array.from(dailyUserTotals.keys()).map(d => d.slice(0,7)))).sort() } as DailyBucketsArtifacts;
    }
    function buildQuotaArtifacts(entries: ProcessedData[]): QuotaArtifacts {
      const quotaByUser = new Map<string, number | 'unlimited'>();
      const conflicts = new Map<string, Set<number | 'unlimited'>>();
      const distinctQuotas = new Set<number>();
      for (const row of entries) {
        if (!quotaByUser.has(row.user)) quotaByUser.set(row.user, row.quotaValue);
        else {
          const existing = quotaByUser.get(row.user);
          if (existing !== row.quotaValue) {
            if (!conflicts.has(row.user)) conflicts.set(row.user, new Set());
            conflicts.get(row.user)!.add(existing!);
            conflicts.get(row.user)!.add(row.quotaValue!);
          }
        }
        if (typeof row.quotaValue === 'number') distinctQuotas.add(row.quotaValue);
      }
      return { quotaByUser, conflicts, distinctQuotas, hasMixedQuotas: distinctQuotas.size > 1, hasMixedLicenses: false } as QuotaArtifacts;
    }

    it('should return empty structure for no data', () => {
      const daily = buildDailyArtifacts([]);
      const quota = buildQuotaArtifacts([]);
      const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
      expect(result).toEqual({ totalUsersExhausted: 0, weeks: [] });
    });

    it('should compute week buckets and first exhaustion correctly (single month)', () => {
      // UserA quota 300: reaches exactly 300 on day 10 (week2) (100+100+100)
      // UserB quota 300: reaches 300 on day 7 (week1) (150+150)
      // UserC unlimited: ignored
      // UserD quota 300: reaches 310 on day 29 (week5)
      const data = makeProcessed([
        { ts: '2025-06-01T10:00:00Z', user: 'UserB', used: 150, quota: 300 },
        { ts: '2025-06-03T10:00:00Z', user: 'UserA', used: 100, quota: 300 },
        { ts: '2025-06-05T10:00:00Z', user: 'UserC', used: 500, quota: 'unlimited' },
        { ts: '2025-06-07T10:00:00Z', user: 'UserB', used: 150, quota: 300 }, // UserB exhausts week1 (day7)
        { ts: '2025-06-08T10:00:00Z', user: 'UserA', used: 100, quota: 300 },
        { ts: '2025-06-10T10:00:00Z', user: 'UserA', used: 100, quota: 300 }, // UserA exhausts week2 (day10)
        { ts: '2025-06-22T10:00:00Z', user: 'UserD', used: 200, quota: 300 },
        { ts: '2025-06-29T10:00:00Z', user: 'UserD', used: 110, quota: 300 }, // UserD exhausts week5 (day29)
      ]);
      const daily = buildDailyArtifacts(data);
      const quota = buildQuotaArtifacts(data);
      const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
      expect(result.totalUsersExhausted).toBe(3);
      // Expect weeks 1,2,5 to have counts 1 each
      const weeks = result.weeks as WeekExhaustion[];
      const w1 = weeks.find(w => w.weekNumber === 1);
      const w2 = weeks.find(w => w.weekNumber === 2);
      const w5 = weeks.find(w => w.weekNumber === 5);
      expect(w1?.usersExhaustedInWeek).toBe(1);
      expect(w2?.usersExhaustedInWeek).toBe(1);
      expect(w5?.usersExhaustedInWeek).toBe(1);
    });

    it('should not double count users if they exceed multiple times', () => {
      // User hits quota in week 3; later requests should not change week assignment
      const data = makeProcessed([
        { ts: '2025-06-15T10:00:00Z', user: 'UserA', used: 200, quota: 300 },
        { ts: '2025-06-18T10:00:00Z', user: 'UserA', used: 120, quota: 300 }, // cumulative 320 -> week3
        { ts: '2025-06-25T10:00:00Z', user: 'UserA', used: 50, quota: 300 }  // extra
      ]);
      const daily = buildDailyArtifacts(data);
      const quota = buildQuotaArtifacts(data);
      const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
      expect(result.totalUsersExhausted).toBe(1);
      const w3 = (result.weeks as WeekExhaustion[]).find(w => w.weekNumber === 3);
      expect(w3?.usersExhaustedInWeek).toBe(1);
      expect(result.weeks.length).toBe(1);
    });

    it('should handle multiple months by producing separate week entries ordered properly', () => {
      const data = makeProcessed([
        { ts: '2025-06-05T10:00:00Z', user: 'UserJ', used: 400, quota: 300 }, // June week1
        { ts: '2025-07-09T10:00:00Z', user: 'UserK', used: 500, quota: 300 }  // July week2
      ]);
      const daily = buildDailyArtifacts(data);
      const quota = buildQuotaArtifacts(data);
      const result = computeWeeklyQuotaExhaustionFromArtifacts(daily, quota);
      expect(result.totalUsersExhausted).toBe(2);
      // Weeks should contain week1 then week2 (from next month)
      expect(result.weeks[0].weekNumber).toBe(1);
      expect(result.weeks[1].weekNumber).toBe(2);
    });
  });
});
