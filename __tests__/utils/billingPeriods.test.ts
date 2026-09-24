import { PRICING } from '@/constants/pricing';
import { buildMonthListFromArtifacts } from '@/utils/ingestion/analytics';
import { filterBySelectedMonths } from '@/utils/analytics/filters';

import { processCSVData } from '../helpers/processCSVData';
import { buildMinimalDailyBucketsArtifact } from '../helpers/testUtils';
import { CSVData } from '../../src/types/csv';

describe('Billing Period Boundaries', () => {
  const testData: CSVData[] = [
    {
      date: '2025-06-30', // Last day of June
      username: 'test-user-one',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'gpt-4.1-2025-04-14',
      quantity: '5.00',
      total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
    },
    {
      date: '2025-07-01', // First day of July
      username: 'test-user-one',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'claude-3.5-sonnet-2024-10-22',
      quantity: '10.50',
      total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
    },
    {
      date: '2025-07-31', // Last day of July
      username: 'test-user-one',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'gemini-2.0-flash',
      quantity: '150.00',
      total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
    },
    {
      date: '2025-08-01', // First day of August
      username: 'test-user-two',
      sku: 'copilot_ai_credit',
      unit_type: 'ai-credits',
      model: 'gpt-4.1-2025-04-14',
      quantity: '20.00',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA)
    }
  ];

  it('should correctly identify available months from boundary data', () => {
    const processedData = processCSVData(testData);
    const artifacts = buildMinimalDailyBucketsArtifact(processedData);
    const availableMonths = buildMonthListFromArtifacts(artifacts);
    
    console.log('Available months:', availableMonths);
    
    // Should identify June, July, and August as separate months
    expect(availableMonths).toHaveLength(3);
    expect(availableMonths.map(m => m.value)).toEqual(['2025-06', '2025-07', '2025-08']);
  });

  it('should filter July data correctly (1st to 31st only)', () => {
    const processedData = processCSVData(testData);
    const julyData = filterBySelectedMonths(processedData, ['2025-07']);
    
    console.log('July filtered data timestamps:', julyData.map(d => d.timestamp.toISOString()));
    
    // Should only include July 1st and July 31st records (normalized to midnight UTC)
    expect(julyData).toHaveLength(2);
    expect(julyData[0].timestamp.toISOString()).toBe('2025-07-01T00:00:00.000Z');
    expect(julyData[1].timestamp.toISOString()).toBe('2025-07-31T00:00:00.000Z');
  });

  it('should not include June 30th in July billing period', () => {
    const processedData = processCSVData(testData);
    const julyData = filterBySelectedMonths(processedData, ['2025-07']);
    
    // Should not include June 30th timestamp
    const june30thIncluded = julyData.some(d => 
      d.timestamp.toISOString().startsWith('2025-06-30')
    );
    expect(june30thIncluded).toBe(false);
  });

  it('should not include August 1st in July billing period', () => {
    const processedData = processCSVData(testData);
    const julyData = filterBySelectedMonths(processedData, ['2025-07']);
    
    // Should not include August 1st timestamp
    const aug1stIncluded = julyData.some(d => 
      d.timestamp.toISOString().startsWith('2025-08-01')
    );
    expect(aug1stIncluded).toBe(false);
  });
});
