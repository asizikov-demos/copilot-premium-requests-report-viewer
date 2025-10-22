import { processCSVData, getAvailableMonths, filterBySelectedMonths } from '../../src/utils/analytics';
import { CSVData } from '../../src/types/csv';

describe('Billing Period Boundaries', () => {
  const testData: CSVData[] = [
    {
      date: '2025-06-30', // Last day of June
      username: 'UserA',
      model: 'gpt-4.1-2025-04-14',
      quantity: '5.00',
      exceeds_quota: 'false',
      total_monthly_quota: '300'
    },
    {
      date: '2025-07-01', // First day of July
      username: 'UserA',
      model: 'claude-3.5-sonnet-2024-10-22',
      quantity: '10.50',
      exceeds_quota: 'false',
      total_monthly_quota: '300'
    },
    {
      date: '2025-07-31', // Last day of July
      username: 'UserA',
      model: 'gemini-2.0-flash',
      quantity: '150.00',
      exceeds_quota: 'false',
      total_monthly_quota: '300'
    },
    {
      date: '2025-08-01', // First day of August
      username: 'UserB',
      model: 'gpt-4.1-2025-04-14',
      quantity: '20.00',
      exceeds_quota: 'false',
      total_monthly_quota: '1000'
    }
  ];

  it('should correctly identify available months from boundary data', () => {
    const processedData = processCSVData(testData);
    const availableMonths = getAvailableMonths(processedData);
    
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
