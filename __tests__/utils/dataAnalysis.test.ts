import { buildMonthListFromArtifacts } from '@/utils/ingestion/analytics';
import { selectArtifacts } from '../helpers/normalizedArtifacts';
import { PRICING } from '@/constants/pricing';
import { CSVData } from '@/types/csv';
import type { NormalizedRow } from '@/utils/ingestion';

import { normalizeRows } from '../helpers/normalizeRows';
import { analyzeRows } from '../helpers/normalizedArtifacts';
import { validCSVData } from '../fixtures/validCSVData';
import {
  buildMinimalDailyBucketsArtifact,
  createMockCSVData,
  makeUsageRow
} from '../helpers/testUtils';

// Explicit model credits interface to remove implicit any usage
interface ModelCredit { model: string; totalCredits: number }
const modelTotal = (credits: ModelCredit[], name: string) => credits.find(r => r.model === name)?.totalCredits;

describe('CSV Data Processing', () => {
  describe('normalizeRows', () => {
    it('should correctly process valid CSV data', () => {
      const result = normalizeRows(validCSVData);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        day: '2025-06-03T00:00:00Z'.slice(0, 10),
        user: 'test-user-one',
        model: 'gpt-4.1-2025-04-14',
        quantity: 1.00,
        quotaRaw: 'Unknown',
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
      expect(normalizeRows([testData])).toEqual([]);
    });

    it('should handle numeric conversion correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: '3.14159'
        })
      ];
      
      const result = normalizeRows(testData);
      expect(result[0].quantity).toBe(3.14159);
    });

    it('should handle invalid numbers gracefully', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: 'invalid'
        })
      ];
      
      const result = normalizeRows(testData);
      expect(result).toEqual([]);
    });

    it('should handle zero values correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          quantity: '0'
        })
      ];
      
      const result = normalizeRows(testData);
      expect(result[0].quantity).toBe(0);
    });

    it('should use production quota parsing for blank quotas', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          username: 'test-user-one',
          total_monthly_quota: '   '
        })
      ];

      const result = normalizeRows(testData);
      expect(result[0].quotaValue).toBe('unknown');
    });

    it('should handle empty array', () => {
      const result = normalizeRows([]);
      expect(result).toEqual([]);
    });

    it('should preserve all user and model information', () => {
      const result = normalizeRows(validCSVData);
      
      expect(result[1]).toMatchObject({
        day: '2025-06-03T00:00:00Z'.slice(0, 10),
        user: 'test-user-two',
        model: 'claude-3.7-sonnet-thought',
        quantity: 2.50,
        quotaRaw: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
        quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA
      });
    });

  });

  describe('analyzeRows', () => {
    it('should return empty analysis for empty data', () => {
      const result = analyzeRows([]);
      
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
      const rows = normalizeRows(validCSVData);
      const result = analyzeRows(rows);
      
      expect(result.totalUniqueUsers).toBe(3);
      expect(result.usersExceedingQuota).toBe(0);
      expect(result.creditsByModel).toHaveLength(4); // 4 different models
    });

    it('should calculate correct time frame', () => {
      const rows = normalizeRows(validCSVData);
      const result = analyzeRows(rows);
      
      expect(result.timeFrame.start).toBe('2025-06-03');
      expect(result.timeFrame.end).toBe('2025-06-04');
    });

    it('should aggregate AI credits by model correctly', () => {
      const rows = normalizeRows(validCSVData);
      const result = analyzeRows(rows) as { creditsByModel: ModelCredit[] };
      expect(modelTotal(result.creditsByModel, 'gpt-4.1-2025-04-14')).toBe(1);
      expect(modelTotal(result.creditsByModel, 'claude-3.7-sonnet-thought')).toBe(2.5);
    });

    it('should handle single data point', () => {
      const singleData = normalizeRows([validCSVData[0]]);
      const result = analyzeRows(singleData);
      
      expect(result.totalUniqueUsers).toBe(1);
      expect(result.usersExceedingQuota).toBe(0);
      expect(result.creditsByModel).toHaveLength(1);
    });

    it('should sort data by timestamp internally', () => {
      // Create data with mixed dates
      const mixedData: CSVData[] = [
        createMockCSVData({ 
          date: '2025-06-05',
          username: 'test-user-one'
        }),
        createMockCSVData({ 
          date: '2025-06-03',
          username: 'test-user-two'
        }),
        createMockCSVData({ 
          date: '2025-06-04',
          username: 'test-user-three'
        })
      ];
      
      const rows = normalizeRows(mixedData);
      const result = analyzeRows(rows);
      
      expect(result.timeFrame.start).toBe('2025-06-03');
      expect(result.timeFrame.end).toBe('2025-06-05');
    });

    it('should resolve conflicting user quotas before counting quota overages', () => {
      const rows = normalizeRows([
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

      const result = analyzeRows(rows);

      expect(result.usersExceedingQuota).toBe(1);
      expect(result.quotaBreakdown.enterprise).toEqual(['test-user-one']);
      expect(result.quotaBreakdown.unknown).toEqual([]);
      expect(result.quotaBreakdown.business).toEqual(['test-user-two']);
    });
  });

  describe('Date Filtering Functions', () => {
    const createTestDataForDate = (dateString: string): NormalizedRow => {
      const timestamp = new Date(dateString);
      return makeUsageRow({
        day: timestamp.toISOString().slice(0, 10),
        user: 'test-user-one',
        model: 'test-model',
        quantity: 1.0,
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
        const filtered = selectArtifacts(testData, ['2025-06', '2025-08']);
        expect([...filtered.dailyBucketsArtifacts.dailyUserTotals.keys()].sort()).toEqual([
          '2025-06-15', '2025-06-20', '2025-08-15',
        ]);
        expect(filtered.usageArtifacts.users[0].totalCredits).toBe(3);
      });

      it('should return all data when no months selected', () => {
        const filtered = selectArtifacts(testData, []);
        expect(filtered.usageArtifacts.users[0].totalCredits).toBe(4);
      });

      it('should return empty array when no data matches selected months', () => {
        const filtered = selectArtifacts(testData, ['2025-12']);
        expect(filtered.usageArtifacts.users).toEqual([]);
      });
    });
  });

});
