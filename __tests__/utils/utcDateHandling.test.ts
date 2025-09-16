import { processCSVData, getAvailableMonths, filterBySelectedMonths } from '../../src/utils/analytics';
import { CSVData } from '../../src/types/csv';

describe('UTC Date Handling and Billing Periods', () => {
  const edgeCaseData: CSVData[] = [
    {
      Timestamp: '2025-06-30T23:59:59Z', // Last second of June UTC
      User: 'UserA',
      Model: 'gpt-4.1-2025-04-14',
      'Requests Used': '10.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '300'
    },
    {
      Timestamp: '2025-07-01T00:00:00Z', // First second of July UTC
      User: 'UserA',
      Model: 'claude-3.5-sonnet-2024-10-22',
      'Requests Used': '15.50',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '300'
    },
    {
      Timestamp: '2025-07-31T23:59:59Z', // Last second of July UTC
      User: 'UserB',
      Model: 'gemini-2.0-flash',
      'Requests Used': '200.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '1000'
    },
    {
      Timestamp: '2025-08-01T00:00:00Z', // First second of August UTC
      User: 'UserB',
      Model: 'gpt-4.1-2025-04-14',
      'Requests Used': '25.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '1000'
    },
    {
      Timestamp: '2025-12-31T23:59:59Z', // Last second of year UTC
      User: 'UserC',
      Model: 'o3-mini',
      'Requests Used': '5.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': 'Unlimited'
    }
  ];

  it('should treat timestamps as exact UTC dates without conversion', () => {
    const processedData = processCSVData(edgeCaseData);
    
    // Verify that timestamps are preserved exactly as UTC
    expect(processedData[0].timestamp.toISOString()).toBe('2025-06-30T23:59:59.000Z');
    expect(processedData[1].timestamp.toISOString()).toBe('2025-07-01T00:00:00.000Z');
    expect(processedData[2].timestamp.toISOString()).toBe('2025-07-31T23:59:59.000Z');
    expect(processedData[3].timestamp.toISOString()).toBe('2025-08-01T00:00:00.000Z');
    expect(processedData[4].timestamp.toISOString()).toBe('2025-12-31T23:59:59.000Z');
  });

  it('should correctly identify billing periods (1st to last day of month)', () => {
    const processedData = processCSVData(edgeCaseData);
    const availableMonths = getAvailableMonths(processedData);
    
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
      '2025-07-31T23:59:59.000Z'
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
    
    // Should only include December 31st record (last second of the year)
    expect(decemberData).toHaveLength(1);
    expect(decemberData[0].timestamp.toISOString()).toBe('2025-12-31T23:59:59.000Z');
    expect(decemberData[0].user).toBe('UserC');
  });

  it('should handle multiple billing periods selection', () => {
    const processedData = processCSVData(edgeCaseData);
    const multiMonthData = filterBySelectedMonths(processedData, ['2025-07', '2025-08']);
    
    // Should include July and August data (3 records)
    expect(multiMonthData).toHaveLength(3);
    
    const timestamps = multiMonthData.map(d => d.timestamp.toISOString()).sort();
    expect(timestamps).toEqual([
      '2025-07-01T00:00:00.000Z',
      '2025-07-31T23:59:59.000Z', 
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
    // This test ensures that even dates that might be interpreted differently 
    // in local timezone are handled correctly as UTC
    const timezoneEdgeData: CSVData[] = [
      {
        Timestamp: '2025-03-31T23:00:00Z', // 11 PM UTC on March 31st
        User: 'UserX',
        Model: 'test-model',
        'Requests Used': '1.00',
        'Exceeds Monthly Quota': 'false',
        'Total Monthly Quota': '300'
      },
      {
        Timestamp: '2025-04-01T01:00:00Z', // 1 AM UTC on April 1st  
        User: 'UserX',
        Model: 'test-model',
        'Requests Used': '1.00',
        'Exceeds Monthly Quota': 'false',
        'Total Monthly Quota': '300'
      }
    ];

    const processedData = processCSVData(timezoneEdgeData);
    const availableMonths = getAvailableMonths(processedData);
    
    // Should correctly identify March and April as separate months
    expect(availableMonths.map(m => m.value)).toEqual(['2025-03', '2025-04']);
    
    // March data should only include March record
    const marchData = filterBySelectedMonths(processedData, ['2025-03']);
    expect(marchData).toHaveLength(1);
    expect(marchData[0].timestamp.toISOString()).toBe('2025-03-31T23:00:00.000Z');
    
    // April data should only include April record
    const aprilData = filterBySelectedMonths(processedData, ['2025-04']);
    expect(aprilData).toHaveLength(1);
    expect(aprilData[0].timestamp.toISOString()).toBe('2025-04-01T01:00:00.000Z');
  });
});
