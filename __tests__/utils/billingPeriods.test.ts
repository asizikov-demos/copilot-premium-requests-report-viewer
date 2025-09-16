import { processCSVData, getAvailableMonths, filterBySelectedMonths } from '../../src/utils/analytics';
import { CSVData } from '../../src/types/csv';

describe('Billing Period Boundaries', () => {
  const testData: CSVData[] = [
    {
      Timestamp: '2025-06-30T23:59:59Z', // Last second of June
      User: 'UserA',
      Model: 'gpt-4.1-2025-04-14',
      'Requests Used': '5.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '300'
    },
    {
      Timestamp: '2025-07-01T00:00:00Z', // First second of July
      User: 'UserA',
      Model: 'claude-3.5-sonnet-2024-10-22',
      'Requests Used': '10.50',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '300'
    },
    {
      Timestamp: '2025-07-31T23:59:59Z', // Last second of July
      User: 'UserA',
      Model: 'gemini-2.0-flash',
      'Requests Used': '150.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '300'
    },
    {
      Timestamp: '2025-08-01T00:00:00Z', // First second of August
      User: 'UserB',
      Model: 'gpt-4.1-2025-04-14',
      'Requests Used': '20.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '1000'
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
    
    // Should only include July 1st and July 31st records
    expect(julyData).toHaveLength(2);
    expect(julyData[0].timestamp.toISOString()).toBe('2025-07-01T00:00:00.000Z');
    expect(julyData[1].timestamp.toISOString()).toBe('2025-07-31T23:59:59.000Z');
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
