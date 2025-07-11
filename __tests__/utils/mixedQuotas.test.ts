import { processCSVData, analyzeData, getUserQuotaValue } from '../../src/utils/dataAnalysis';
import { CSVData } from '../../src/types/csv';

describe('Mixed Quota Support', () => {
  const mockData: CSVData[] = [
    {
      Timestamp: '2025-06-01T10:00:00Z',
      User: 'UserA',
      Model: 'gpt-4.1-2025-04-14',
      'Requests Used': '5.00',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '300'
    },
    {
      Timestamp: '2025-06-15T11:00:00Z',
      User: 'UserB',
      Model: 'claude-3.5-sonnet-2024-10-22',
      'Requests Used': '10.50',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': '1000'
    },
    {
      Timestamp: '2025-07-01T10:00:00Z',
      User: 'UserC',
      Model: 'gpt-4.1-2025-04-14',
      'Requests Used': '15.25',
      'Exceeds Monthly Quota': 'false',
      'Total Monthly Quota': 'Unlimited'
    },
    {
      Timestamp: '2025-07-10T11:00:00Z',
      User: 'UserA',
      Model: 'gemini-2.0-flash',
      'Requests Used': '350.00',
      'Exceeds Monthly Quota': 'true',
      'Total Monthly Quota': '300'
    }
  ];

  it('should correctly parse quota values', () => {
    const processedData = processCSVData(mockData);
    
    expect(processedData[0].quotaValue).toBe(300);
    expect(processedData[1].quotaValue).toBe(1000);
    expect(processedData[2].quotaValue).toBe('unlimited');
    expect(processedData[3].quotaValue).toBe(300);
  });

  it('should correctly build quota breakdown', () => {
    const processedData = processCSVData(mockData);
    const analysis = analyzeData(processedData);
    
    expect(analysis.quotaBreakdown.business).toContain('UserA');
    expect(analysis.quotaBreakdown.enterprise).toContain('UserB');
    expect(analysis.quotaBreakdown.unlimited).toContain('UserC');
    expect(analysis.quotaBreakdown.mixed).toBe(true);
    expect(analysis.quotaBreakdown.suggestedPlan).toBe(null); // Mixed should not suggest a plan
  });

  it('should correctly identify users exceeding their specific quotas', () => {
    const processedData = processCSVData(mockData);
    const analysis = analyzeData(processedData);
    
    // UserA exceeds 300 quota (355 total), UserB doesn't exceed 1000 quota (10.5 total), UserC unlimited
    expect(analysis.usersExceedingQuota).toBe(1); // Only UserA
  });

  it('should get user quota value correctly', () => {
    const processedData = processCSVData(mockData);
    
    expect(getUserQuotaValue(processedData, 'UserA')).toBe(300);
    expect(getUserQuotaValue(processedData, 'UserB')).toBe(1000);
    expect(getUserQuotaValue(processedData, 'UserC')).toBe('unlimited');
    expect(getUserQuotaValue(processedData, 'NonExistentUser')).toBe('unlimited');
  });

  it('should suggest business plan for all business users', () => {
    const businessOnlyData: CSVData[] = [
      {
        Timestamp: '2025-06-01T10:00:00Z',
        User: 'UserA',
        Model: 'gpt-4.1-2025-04-14',
        'Requests Used': '5.00',
        'Exceeds Monthly Quota': 'false',
        'Total Monthly Quota': '300'
      },
      {
        Timestamp: '2025-06-15T11:00:00Z',
        User: 'UserB',
        Model: 'claude-3.5-sonnet-2024-10-22',
        'Requests Used': '10.50',
        'Exceeds Monthly Quota': 'false',
        'Total Monthly Quota': '300'
      }
    ];

    const processedData = processCSVData(businessOnlyData);
    const analysis = analyzeData(processedData);
    
    expect(analysis.quotaBreakdown.mixed).toBe(false);
    expect(analysis.quotaBreakdown.suggestedPlan).toBe('business');
    expect(analysis.quotaBreakdown.business).toEqual(['UserA', 'UserB']);
    expect(analysis.quotaBreakdown.enterprise).toEqual([]);
    expect(analysis.quotaBreakdown.unlimited).toEqual([]);
  });

  it('should suggest enterprise plan for all enterprise users', () => {
    const enterpriseOnlyData: CSVData[] = [
      {
        Timestamp: '2025-06-01T10:00:00Z',
        User: 'UserA',
        Model: 'gpt-4.1-2025-04-14',
        'Requests Used': '5.00',
        'Exceeds Monthly Quota': 'false',
        'Total Monthly Quota': '1000'
      },
      {
        Timestamp: '2025-06-15T11:00:00Z',
        User: 'UserB',
        Model: 'claude-3.5-sonnet-2024-10-22',
        'Requests Used': '10.50',
        'Exceeds Monthly Quota': 'false',
        'Total Monthly Quota': '1000'
      }
    ];

    const processedData = processCSVData(enterpriseOnlyData);
    const analysis = analyzeData(processedData);
    
    expect(analysis.quotaBreakdown.mixed).toBe(false);
    expect(analysis.quotaBreakdown.suggestedPlan).toBe('enterprise');
    expect(analysis.quotaBreakdown.business).toEqual([]);
    expect(analysis.quotaBreakdown.enterprise).toEqual(['UserA', 'UserB']);
    expect(analysis.quotaBreakdown.unlimited).toEqual([]);
  });
});
