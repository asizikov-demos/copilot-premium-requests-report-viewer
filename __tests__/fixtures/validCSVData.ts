import { CSVData } from '@/types/csv';

export const validCSVData: CSVData[] = [
  {
    date: '2025-06-03',
    username: 'test-user-a',
    model: 'gpt-4.1-2025-04-14',
    quantity: '1.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-03',
    username: 'test-user-b',
    model: 'claude-3.7-sonnet-thought',
    quantity: '2.50',
    exceeds_quota: 'true',
    total_monthly_quota: '100'
  },
  {
    date: '2025-06-04',
    username: 'test-user-c',
    model: 'gemini-2.0-flash',
    quantity: '0.75',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-04',
    username: 'test-user-a',
    model: 'o3-mini',
    quantity: '1.25',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  }
];

export const validCSVString = `date,username,model,quantity,exceeds_quota,total_monthly_quota
2025-06-03,test-user-a,gpt-4.1-2025-04-14,1.00,false,Unknown
2025-06-03,test-user-b,claude-3.7-sonnet-thought,2.50,true,100
2025-06-04,test-user-c,gemini-2.0-flash,0.75,false,Unknown
2025-06-04,test-user-a,o3-mini,1.25,false,Unknown`;

export const powerUserCSVData: CSVData[] = [
  {
    date: '2025-06-01',
    username: 'test-power-user',
    model: 'gpt-4.5',
    quantity: '5.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-01',
    username: 'test-power-user',
    model: 'claude-3.7-sonnet-thought',
    quantity: '8.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-01',
    username: 'test-power-user',
    model: 'gemini-2.0-flash',
    quantity: '3.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-01',
    username: 'test-power-user',
    model: 'o3-mini',
    quantity: '2.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-01',
    username: 'test-power-user',
    model: 'Code Review',
    quantity: '1.50',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-01',
    username: 'test-power-user',
    model: 'gpt-4-vision',
    quantity: '2.50',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-02',
    username: 'test-regular-user',
    model: 'gpt-4.1-2025-04-14',
    quantity: '1.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unknown'
  }
];
