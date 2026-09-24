import type { UsageArtifacts } from '@/utils/ingestion';
import { buildMonthListFromArtifacts } from '@/utils/ingestion/analytics';
import { filterBySelectedMonths } from '@/utils/analytics/filters';
import { PRICING } from '@/constants/pricing';
import { CSVData, ProcessedData } from '@/types/csv';

import { processCSVData, analyzeData } from '../helpers/processCSVData';
import { validCSVData, powerUserCSVData } from '../fixtures/validCSVData';
import {
  buildMinimalDailyBucketsArtifact,
  createMockCSVData,
  createMockCSVDataArray,
  makeProcessedData
} from '../helpers/testUtils';

// Explicit model credits interface to remove implicit any usage
interface ModelCredit { model: string; totalCredits: number }
const modelTotal = (credits: ModelCredit[], name: string) => credits.find(r => r.model === name)?.totalCredits;

describe('CSV Data Processing', () => {
  describe('processCSVData', () => {
    it('should correctly process valid CSV data', () => {
      const result = processCSVData(validCSVData);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        timestamp: new Date('2025-06-03T00:00:00Z'),
        user: 'test-user-one',
        model: 'gpt-4.1-2025-04-14',
        creditsUsed: 1.00,
        totalQuota: 'Unknown',
        quotaValue: 'unknown'
      });
    });

    it('rejects request-unit rows without converting them into AI credits', () => {
      const testData = createMockCSVData({
        unit_type: 'requests',
        sku: 'copilot_premium_request',
        quantity: '5',
        aic_quantity: '20',
      });
      expect(processCSVData([testData])).toEqual([]);
    });

    it('should handle numeric conversion correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: '3.14159'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].creditsUsed).toBe(3.14159);
    });

    it('should handle invalid numbers gracefully', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: 'invalid'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].creditsUsed).toBeNaN();
    });

    it('should handle zero values correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: '0'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].creditsUsed).toBe(0);
    });

    it('should use production quota parsing for blank quotas', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          username: 'test-user-one',
          total_monthly_quota: '   '
        })
      ];

      const result = processCSVData(testData);
      expect(result[0].quotaValue).toBe('unknown');
    });

    it('should handle empty array', () => {
      const result = processCSVData([]);
      expect(result).toEqual([]);
    });

    it('should preserve all user and model information', () => {
      const result = processCSVData(validCSVData);
      
      expect(result[1]).toMatchObject({
        timestamp: new Date('2025-06-03T00:00:00Z'),
        user: 'test-user-two',
        model: 'claude-3.7-sonnet-thought',
        creditsUsed: 2.50,
        totalQuota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
        quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA
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
        creditsByModel: [],
        quotaBreakdown: {
          unknown: [],
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
      
      expect(result.totalUniqueUsers).toBe(3);
      expect(result.usersExceedingQuota).toBe(0);
      expect(result.creditsByModel).toHaveLength(4); // 4 different models
    });

    it('should calculate correct time frame', () => {
      const processedData = processCSVData(validCSVData);
      const result = analyzeData(processedData);
      
      expect(result.timeFrame.start).toBe('2025-06-03');
      expect(result.timeFrame.end).toBe('2025-06-04');
    });

    it('should aggregate AI credits by model correctly', () => {
      const processedData = processCSVData(validCSVData);
      const result = analyzeData(processedData) as { creditsByModel: ModelCredit[] };
      expect(modelTotal(result.creditsByModel, 'gpt-4.1-2025-04-14')).toBe(1);
      expect(modelTotal(result.creditsByModel, 'claude-3.7-sonnet-thought')).toBe(2.5);
    });

    it('should handle single data point', () => {
      const singleData = processCSVData([validCSVData[0]]);
      const result = analyzeData(singleData);
      
      expect(result.totalUniqueUsers).toBe(1);
      expect(result.usersExceedingQuota).toBe(0);
      expect(result.creditsByModel).toHaveLength(1);
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
          quantity: String(PRICING.BUSINESS_AI_CREDIT_QUOTA + 100),
          total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
        }),
        createMockCSVData({
          username: 'test-user-one',
          quantity: '0',
          total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        }),
        createMockCSVData({
          username: 'test-user-two',
          quantity: String(PRICING.BUSINESS_AI_CREDIT_QUOTA + 100),
          total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
        }),
        createMockCSVData({
          username: 'test-user-two',
          quantity: '0',
          total_monthly_quota: 'Unknown',
        }),
      ]);

      const result = analyzeData(processedData);

      expect(result.usersExceedingQuota).toBe(1);
      expect(result.quotaBreakdown.enterprise).toEqual(['test-user-one']);
      expect(result.quotaBreakdown.unknown).toEqual([]);
      expect(result.quotaBreakdown.business).toEqual(['test-user-two']);
    });
  });

  // Helper: build minimal UsageArtifacts from processed data for artifact power user tests
  function buildUsageArtifacts(processed: ProcessedData[]): UsageArtifacts {
    const modelTotals: Record<string, number> = {};
    const usersMap = new Map<string, { totalCredits: number; modelBreakdown: Record<string, number> }>();
    for (const row of processed) {
      modelTotals[row.model] = (modelTotals[row.model] || 0) + row.creditsUsed;
      const entry = usersMap.get(row.user) || { totalCredits: 0, modelBreakdown: {} };
      entry.totalCredits += row.creditsUsed;
      entry.modelBreakdown[row.model] = (entry.modelBreakdown[row.model] || 0) + row.creditsUsed;
      usersMap.set(row.user, entry);
    }
    const users = Array.from(usersMap.entries()).map(([user, v]) => {
      let topModel: string | undefined; let topModelValue = 0;
      for (const [m, qty] of Object.entries(v.modelBreakdown)) { if (qty > topModelValue) { topModelValue = qty; topModel = m; } }
      return { user, totalCredits: v.totalCredits, modelBreakdown: v.modelBreakdown, topModel, topModelValue };
    });
    return { users, modelTotals, userCount: users.length, modelCount: Object.keys(modelTotals).length } as UsageArtifacts;
  }

  describe('Date Filtering Functions', () => {
    const createTestDataForDate = (dateString: string): ProcessedData => {
      const timestamp = new Date(dateString);
      return makeProcessedData({
        timestamp,
        user: 'test-user',
        model: 'test-model',
        creditsUsed: 1.0,
        quotaValue: 100,
      });
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

});
