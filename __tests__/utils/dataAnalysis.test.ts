import { 
  processCSVData, 
  analyzeData, 
  analyzePowerUsers, 
  calculateSpecialFeaturesScore, 
  SPECIAL_FEATURES_CONFIG, 
  MAX_SPECIAL_FEATURES_SCORE,
  containsJune2025Data,
  filterEarlyJune2025,
  getAvailableMonths,
  hasMultipleMonths,
  filterBySelectedMonths
} from '@/utils/dataAnalysis';
import { CSVData, ProcessedData } from '@/types/csv';
import { validCSVData, powerUserCSVData } from '../fixtures/validCSVData';
import { createMockCSVData, createMockCSVDataArray } from '../helpers/testUtils';

describe('CSV Data Processing', () => {
  describe('processCSVData', () => {
    it('should correctly process valid CSV data', () => {
      const result = processCSVData(validCSVData);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        timestamp: new Date('2025-06-03T11:05:27Z'),
        user: 'USerA',
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
          'Exceeds Monthly Quota': 'TRUE'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].exceedsQuota).toBe(true);
    });

    it('should handle case-insensitive boolean conversion', () => {
      const testData: CSVData[] = [
        createMockCSVData({ 'Exceeds Monthly Quota': 'True' }),
        createMockCSVData({ 'Exceeds Monthly Quota': 'FALSE' }),
        createMockCSVData({ 'Exceeds Monthly Quota': 'false' })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].exceedsQuota).toBe(true);
      expect(result[1].exceedsQuota).toBe(false);
      expect(result[2].exceedsQuota).toBe(false);
    });

    it('should handle numeric conversion correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          'Requests Used': '3.14159'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].requestsUsed).toBe(3.14159);
    });

    it('should handle invalid numbers gracefully', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          'Requests Used': 'invalid'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].requestsUsed).toBeNaN();
    });

    it('should handle zero values correctly', () => {
      const testData: CSVData[] = [
        createMockCSVData({
          'Requests Used': '0'
        })
      ];
      
      const result = processCSVData(testData);
      expect(result[0].requestsUsed).toBe(0);
    });

    it('should handle empty array', () => {
      const result = processCSVData([]);
      expect(result).toEqual([]);
    });

    it('should preserve all user and model information', () => {
      const result = processCSVData(validCSVData);
      
      expect(result[1]).toEqual({
        timestamp: new Date('2025-06-03T14:22:15Z'),
        user: 'JohnDoe',
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
      
      expect(result.totalUniqueUsers).toBe(3); // USerA, JohnDoe, AliceSmith
      expect(result.usersExceedingQuota).toBe(0); // Nobody actually exceeds their quota (JohnDoe: 2.5/100, others unlimited)
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
      const result = analyzeData(processedData);
      
      const gptModel = result.requestsByModel.find(m => m.model === 'gpt-4.1-2025-04-14');
      expect(gptModel?.totalRequests).toBe(1.00);
      
      const claudeModel = result.requestsByModel.find(m => m.model === 'claude-3.7-sonnet-thought');
      expect(claudeModel?.totalRequests).toBe(2.50);
    });

    it('should handle single data point', () => {
      const singleData = processCSVData([validCSVData[0]]);
      const result = analyzeData(singleData);
      
      expect(result.totalUniqueUsers).toBe(1);
      expect(result.usersExceedingQuota).toBe(0);
      expect(result.requestsByModel).toHaveLength(1);
    });

    it('should sort data by timestamp internally', () => {
      // Create data with mixed timestamps
      const mixedData: CSVData[] = [
        createMockCSVData({ 
          Timestamp: '2025-06-05T10:00:00Z',
          User: 'User1'
        }),
        createMockCSVData({ 
          Timestamp: '2025-06-03T10:00:00Z',
          User: 'User2'
        }),
        createMockCSVData({ 
          Timestamp: '2025-06-04T10:00:00Z',
          User: 'User3'
        })
      ];
      
      const processedData = processCSVData(mixedData);
      const result = analyzeData(processedData);
      
      expect(result.timeFrame.start).toBe('2025-06-03');
      expect(result.timeFrame.end).toBe('2025-06-05');
    });
  });

  describe('analyzePowerUsers', () => {
    it('should identify power users correctly', () => {
      const processedData = processCSVData(powerUserCSVData);
      const result = analyzePowerUsers(processedData);
      
      expect(result.powerUsers).toHaveLength(1);
      expect(result.powerUsers[0].user).toBe('PowerUser1');
      expect(result.powerUsers[0].totalRequests).toBe(22); // Sum of all requests
    });

    it('should calculate power user scores correctly', () => {
      const processedData = processCSVData(powerUserCSVData);
      const result = analyzePowerUsers(processedData);
      const powerUser = result.powerUsers[0];
      
      expect(powerUser.breakdown).toHaveProperty('diversityScore');
      expect(powerUser.breakdown).toHaveProperty('specialFeaturesScore');
      expect(powerUser.breakdown).toHaveProperty('visionScore');
      expect(powerUser.breakdown).toHaveProperty('balanceScore');
      
      // Check that scores are numbers
      expect(typeof powerUser.breakdown.diversityScore).toBe('number');
      expect(typeof powerUser.breakdown.specialFeaturesScore).toBe('number');
      expect(typeof powerUser.breakdown.visionScore).toBe('number');
      expect(typeof powerUser.breakdown.balanceScore).toBe('number');
    });

    it('should categorize model usage correctly', () => {
      const processedData = processCSVData(powerUserCSVData);
      const result = analyzePowerUsers(processedData);
      const powerUser = result.powerUsers[0];
      
      expect(powerUser.modelUsage.heavy).toBeGreaterThan(0); // gpt-4.5, claude-3.7-sonnet-thought
      expect(powerUser.modelUsage.light).toBeGreaterThan(0); // gemini-2.0-flash, o3-mini
      expect(powerUser.modelUsage.special).toBeGreaterThan(0); // Code Review
      expect(powerUser.modelUsage.vision).toBeGreaterThan(0); // gpt-4-vision
      // The uniqueModels count will depend on how the algorithm counts models
      expect(powerUser.modelUsage.uniqueModels).toBeGreaterThan(0);
      expect(powerUser.modelUsage.uniqueModels).toBeLessThanOrEqual(6);
    });

    it('should filter out users with insufficient requests', () => {
      // Create data with one power user and one regular user
      const mixedData = [
        ...powerUserCSVData, // PowerUser1 with 22 requests total
        createMockCSVData({ 
          User: 'LowUser',
          'Requests Used': '1.0'
        })
      ];
      
      const processedData = processCSVData(mixedData);
      const result = analyzePowerUsers(processedData);
      
      // Should only include PowerUser1, not LowUser (who has < 20 requests)
      expect(result.powerUsers).toHaveLength(1);
      expect(result.powerUsers[0].user).toBe('PowerUser1');
    });

    it('should handle empty data gracefully', () => {
      const result = analyzePowerUsers([]);
      
      expect(result.powerUsers).toEqual([]);
      expect(result.totalQualifiedUsers).toBe(0);
    });

    it('should limit power users to maximum display count', () => {
      // Create many power users (more than MAX_POWER_USERS_DISPLAYED = 20)
      const manyPowerUsers: CSVData[] = [];
      for (let i = 1; i <= 25; i++) {
        // Create 25 requests per user to qualify as power users
        for (let j = 1; j <= 25; j++) {
          manyPowerUsers.push(createMockCSVData({
            User: `PowerUser${i}`,
            'Requests Used': '1.0',
            Timestamp: `2025-06-${String(j).padStart(2, '0')}T10:00:00Z`
          }));
        }
      }
      
      const processedData = processCSVData(manyPowerUsers);
      const result = analyzePowerUsers(processedData);
      
      expect(result.powerUsers.length).toBeLessThanOrEqual(20);
      expect(result.totalQualifiedUsers).toBe(25);
    });
  });

  describe('calculateSpecialFeaturesScore', () => {
    it('should return 0 for no special features', () => {
      const models = ['gpt-4', 'claude-3-sonnet', 'gemini-pro'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(0);
    });

    it('should calculate score for single special feature', () => {
      const models = ['gpt-4', 'Code Review', 'claude-3'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(8); // code review score
    });

    it('should calculate score for multiple special features', () => {
      const models = ['Code Review', 'Coding Agent', 'gpt-4'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(16); // code review (8) + coding agent (8)
    });

    it('should handle all special features', () => {
      const models = ['Code Review', 'Coding Agent', 'Spark'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(20); // code review (8) + coding agent (8) + spark (4)
    });

    it('should handle Padawan as backward compatible name for Coding Agent', () => {
      const models = ['Code Review', 'Padawan', 'Spark'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(20); // code review (8) + padawan/coding agent (8) + spark (4)
    });

    it('should cap score at maximum value', () => {
      // Add extra models to test capping
      const models = ['Code Review', 'Coding Agent', 'Spark', 'gpt-4', 'claude-3'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(20); // code review (8) + coding agent (8) + spark (4) = 20
    });

    it('should not count both Padawan and Coding Agent if somehow both present', () => {
      // Edge case: if both old and new names appear, should only count once
      const models = ['Padawan', 'Coding Agent', 'Code Review'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(16); // code review (8) + coding agent/padawan (8) - counted only once
    });

    it('should not duplicate scores for same feature type', () => {
      const models = ['Code Review', 'Code Review', 'gpt-4'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(8); // only count code review once
    });

    it('should handle empty model list', () => {
      const score = calculateSpecialFeaturesScore([]);
      expect(score).toBe(0);
    });

    it('should handle exact model name matching only', () => {
      // These are not actual special model names
      const models = ['advanced-gpt-4', 'custom-spark-model', 'enhanced-agent'];
      const score = calculateSpecialFeaturesScore(models);
      expect(score).toBe(0); // No exact matches
    });

    it('should validate SPECIAL_FEATURES_CONFIG structure', () => {
      expect(SPECIAL_FEATURES_CONFIG).toEqual([
        { keyword: 'code review', score: 8, description: 'Code Review feature usage' },
        { keyword: 'coding agent', score: 8, description: 'Coding Agent feature usage' },
        { keyword: 'padawan', score: 8, description: 'Padawan feature usage' },
        { keyword: 'spark', score: 4, description: 'Spark feature usage' }
      ]);
    });

    it('should validate MAX_SPECIAL_FEATURES_SCORE constant', () => {
      expect(MAX_SPECIAL_FEATURES_SCORE).toBe(20);
    });
  });

  describe('Date Filtering Functions', () => {
    const createTestDataForDate = (dateString: string): ProcessedData => ({
      timestamp: new Date(dateString),
      user: 'TestUser',
      model: 'test-model',
      requestsUsed: 1.0,
      exceedsQuota: false,
      totalQuota: '100',
      quotaValue: 100
    });

    describe('containsJune2025Data', () => {
      it('should return true when data contains June 2025', () => {
        const data = [
          createTestDataForDate('2025-05-15T10:00:00Z'), // May 2025
          createTestDataForDate('2025-06-10T10:00:00Z'), // June 2025
          createTestDataForDate('2025-07-15T10:00:00Z')  // July 2025
        ];
        
        expect(containsJune2025Data(data)).toBe(true);
      });

      it('should return false when data does not contain June 2025', () => {
        const data = [
          createTestDataForDate('2025-05-15T10:00:00Z'), // May 2025
          createTestDataForDate('2025-07-15T10:00:00Z'), // July 2025
          createTestDataForDate('2024-06-15T10:00:00Z')  // June 2024
        ];
        
        expect(containsJune2025Data(data)).toBe(false);
      });

      it('should return false for empty data', () => {
        expect(containsJune2025Data([])).toBe(false);
      });
    });

    describe('filterEarlyJune2025', () => {
      it('should filter out data from June 1-18, 2025', () => {
        const data = [
          createTestDataForDate('2025-06-01T10:00:00Z'), // Should be filtered
          createTestDataForDate('2025-06-15T10:00:00Z'), // Should be filtered
          createTestDataForDate('2025-06-18T10:00:00Z'), // Should be filtered (boundary)
          createTestDataForDate('2025-06-19T10:00:00Z'), // Should be kept
          createTestDataForDate('2025-06-25T10:00:00Z'), // Should be kept
          createTestDataForDate('2025-05-15T10:00:00Z'), // Should be kept (different month)
          createTestDataForDate('2025-07-15T10:00:00Z')  // Should be kept (different month)
        ];

        const filtered = filterEarlyJune2025(data);
        
        expect(filtered).toHaveLength(4);
        expect(filtered.map(d => d.timestamp.toISOString())).toEqual([
          '2025-06-19T10:00:00.000Z',
          '2025-06-25T10:00:00.000Z',
          '2025-05-15T10:00:00.000Z',
          '2025-07-15T10:00:00.000Z'
        ]);
      });

      it('should keep all data when no June 2025 data exists', () => {
        const data = [
          createTestDataForDate('2025-05-15T10:00:00Z'),
          createTestDataForDate('2025-07-15T10:00:00Z'),
          createTestDataForDate('2024-06-15T10:00:00Z')
        ];

        const filtered = filterEarlyJune2025(data);
        expect(filtered).toHaveLength(3);
        expect(filtered).toEqual(data);
      });

      it('should handle empty data', () => {
        const filtered = filterEarlyJune2025([]);
        expect(filtered).toEqual([]);
      });

      it('should correctly handle boundary dates', () => {
        const data = [
          createTestDataForDate('2025-06-18T23:59:59Z'), // Last moment of 18th - should be filtered
          createTestDataForDate('2025-06-19T00:00:00Z')  // First moment of 19th - should be kept
        ];

        const filtered = filterEarlyJune2025(data);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].timestamp.toISOString()).toBe('2025-06-19T00:00:00.000Z');
      });
    });

    describe('getAvailableMonths', () => {
      it('should return available months from data', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-07-15T10:00:00Z'),
          createTestDataForDate('2025-06-20T10:00:00Z'),
          createTestDataForDate('2025-08-15T10:00:00Z')
        ];

        const months = getAvailableMonths(data);
        expect(months).toEqual([
          { value: '2025-06', label: 'June 2025' },
          { value: '2025-07', label: 'July 2025' },
          { value: '2025-08', label: 'August 2025' }
        ]);
      });

      it('should return empty array for no data', () => {
        const months = getAvailableMonths([]);
        expect(months).toEqual([]);
      });

      it('should handle single month', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-06-20T10:00:00Z')
        ];

        const months = getAvailableMonths(data);
        expect(months).toEqual([
          { value: '2025-06', label: 'June 2025' }
        ]);
      });
    });

    describe('hasMultipleMonths', () => {
      it('should return true for data spanning multiple months', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-07-15T10:00:00Z')
        ];

        expect(hasMultipleMonths(data)).toBe(true);
      });

      it('should return false for data in single month', () => {
        const data = [
          createTestDataForDate('2025-06-15T10:00:00Z'),
          createTestDataForDate('2025-06-20T10:00:00Z')
        ];

        expect(hasMultipleMonths(data)).toBe(false);
      });

      it('should return false for empty data', () => {
        expect(hasMultipleMonths([])).toBe(false);
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
