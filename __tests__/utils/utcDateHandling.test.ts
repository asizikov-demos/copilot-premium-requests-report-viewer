import { PRICING } from '@/constants/pricing';
import { buildMonthListFromArtifacts } from '@/utils/ingestion/analytics';
import { filterBySelectedMonths } from '@/utils/analytics/filters';

import { processCSVData } from '../helpers/processCSVData';
import { buildMinimalDailyBucketsArtifact } from '../helpers/testUtils';
import { CSVData } from '../../src/types/csv';

describe('UTC Date Handling and Billing Periods', () => {
  const edgeCaseData: CSVData[] = [
    {
      date: '2025-06-30', // Last day of June
      username: 'test-user-one',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'gpt-4.1-2025-04-14',
      quantity: '10.00',
      total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
    },
    {
      date: '2025-07-01', // First day of July
      username: 'test-user-one',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'claude-3.5-sonnet-2024-10-22',
      quantity: '15.50',
      total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
    },
    {
      date: '2025-07-31', // Last day of July
      username: 'test-user-two',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'gemini-2.0-flash',
      quantity: '200.00',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA)
    },
    {
      date: '2025-08-01', // First day of August
      username: 'test-user-two',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'gpt-4.1-2025-04-14',
      quantity: '25.00',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA)
    },
    {
      date: '2025-12-31', // Last day of year
      username: 'test-user-three',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'o3-mini',
      quantity: '5.00',
      total_monthly_quota: 'Unknown'
    }
  ];

  it('should treat dates as exact UTC dates without conversion', () => {
    const processedData = processCSVData(edgeCaseData);
    
    // Verify that timestamps are normalized to midnight UTC
    expect(processedData[0].timestamp.toISOString()).toBe('2025-06-30T00:00:00.000Z');
    expect(processedData[1].timestamp.toISOString()).toBe('2025-07-01T00:00:00.000Z');
    expect(processedData[2].timestamp.toISOString()).toBe('2025-07-31T00:00:00.000Z');
    expect(processedData[3].timestamp.toISOString()).toBe('2025-08-01T00:00:00.000Z');
    expect(processedData[4].timestamp.toISOString()).toBe('2025-12-31T00:00:00.000Z');
  });

  it('should correctly identify billing periods (1st to last day of month)', () => {
    const processedData = processCSVData(edgeCaseData);
    const artifacts = buildMinimalDailyBucketsArtifact(processedData);
    const availableMonths = buildMonthListFromArtifacts(artifacts);
    
    // Should identify June, July, August, and December as separate billing periods
    expect(availableMonths).toHaveLength(4);
    expect(availableMonths.map(m => m.value)).toEqual(['2025-06', '2025-07', '2025-08', '2025-12']);
    expect(availableMonths.map(m => m.label)).toEqual([
      'June 2025',
      'July 2025', 
      'August 2025',
      'December 2025'
    ]);
  });

  it('should filter July billing period correctly (exclude June 30th and August 1st)', () => {
    const processedData = processCSVData(edgeCaseData);
    const julyData = filterBySelectedMonths(processedData, ['2025-07']);
    
    // Should only include July 1st and July 31st records
    expect(julyData).toHaveLength(2);
    
    // Verify the exact timestamps included
    const timestamps = julyData.map(d => d.timestamp.toISOString()).sort();
    expect(timestamps).toEqual([
      '2025-07-01T00:00:00.000Z',
      '2025-07-31T00:00:00.000Z'
    ]);
    
    // Verify June 30th is NOT included
    const june30Included = julyData.some(d => 
      d.timestamp.toISOString().startsWith('2025-06-30')
    );
    expect(june30Included).toBe(false);
    
    // Verify August 1st is NOT included  
    const aug1Included = julyData.some(d => 
      d.timestamp.toISOString().startsWith('2025-08-01')
    );
    expect(aug1Included).toBe(false);
  });

  it('should handle year-end billing period boundaries correctly', () => {
    const processedData = processCSVData(edgeCaseData);
    const decemberData = filterBySelectedMonths(processedData, ['2025-12']);
    
    // Should only include December 31st record (midnight UTC)
    expect(decemberData).toHaveLength(1);
    expect(decemberData[0].timestamp.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    expect(decemberData[0].user).toBe('test-user-three');
  });

  it('should handle multiple billing periods selection', () => {
    const processedData = processCSVData(edgeCaseData);
    const multiMonthData = filterBySelectedMonths(processedData, ['2025-07', '2025-08']);
    
    // Should include July and August data (3 records)
    expect(multiMonthData).toHaveLength(3);
    
    const timestamps = multiMonthData.map(d => d.timestamp.toISOString()).sort();
    expect(timestamps).toEqual([
      '2025-07-01T00:00:00.000Z',
      '2025-07-31T00:00:00.000Z', 
      '2025-08-01T00:00:00.000Z'
    ]);
  });

  it('should return all data when no billing periods are selected', () => {
    const processedData = processCSVData(edgeCaseData);
    const allData = filterBySelectedMonths(processedData, []);
    
    // Should return all 5 records when no filter is applied
    expect(allData).toHaveLength(5);
    expect(allData).toEqual(processedData);
  });

  it('should handle timezone edge cases correctly', () => {
    // This test ensures that all dates are normalized to midnight UTC
    const timezoneEdgeData: CSVData[] = [
      {
        date: '2025-03-31',
        username: 'test-user-one',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
        model: 'test-model',
        quantity: '1.00',
        total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
      },
      {
        date: '2025-04-01',
        username: 'test-user-one',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
        model: 'test-model',
        quantity: '1.00',
        total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
      }
    ];

    const processedData = processCSVData(timezoneEdgeData);
    const artifacts = buildMinimalDailyBucketsArtifact(processedData);
    const availableMonths = buildMonthListFromArtifacts(artifacts);
    
    // Should correctly identify March and April as separate months
    expect(availableMonths.map(m => m.value)).toEqual(['2025-03', '2025-04']);
    
    // March data should only include March record (normalized to midnight)
    const marchData = filterBySelectedMonths(processedData, ['2025-03']);
    expect(marchData).toHaveLength(1);
    expect(marchData[0].timestamp.toISOString()).toBe('2025-03-31T00:00:00.000Z');
    
    // April data should only include April record (normalized to midnight)
    const aprilData = filterBySelectedMonths(processedData, ['2025-04']);
    expect(aprilData).toHaveLength(1);
    expect(aprilData[0].timestamp.toISOString()).toBe('2025-04-01T00:00:00.000Z');
  });
});
