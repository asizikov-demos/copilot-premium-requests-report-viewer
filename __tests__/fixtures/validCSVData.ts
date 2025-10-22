import { CSVData } from '@/types/csv';

export const validCSVData: CSVData[] = [
  {
    date: '2025-06-03',
    username: 'USerA',
    model: 'gpt-4.1-2025-04-14',
    quantity: '1.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-03',
    username: 'JohnDoe',
    model: 'claude-3.7-sonnet-thought',
    quantity: '2.50',
    exceeds_quota: 'true',
    total_monthly_quota: '100'
  },
  {
    date: '2025-06-04',
    username: 'AliceSmith',
    model: 'gemini-2.0-flash',
    quantity: '0.75',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-04',
    username: 'USerA',
    model: 'o3-mini',
    quantity: '1.25',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  }
];

export const validCSVString = `date,username,model,quantity,exceeds_quota,total_monthly_quota
2025-06-03,USerA,gpt-4.1-2025-04-14,1.00,false,Unlimited
2025-06-03,JohnDoe,claude-3.7-sonnet-thought,2.50,true,100
2025-06-04,AliceSmith,gemini-2.0-flash,0.75,false,Unlimited
2025-06-04,USerA,o3-mini,1.25,false,Unlimited`;

export const powerUserCSVData: CSVData[] = [
  {
    date: '2025-06-01',
    username: 'PowerUser1',
    model: 'gpt-4.5',
    quantity: '5.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-01',
    username: 'PowerUser1',
    model: 'claude-3.7-sonnet-thought',
    quantity: '8.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-01',
    username: 'PowerUser1',
    model: 'gemini-2.0-flash',
    quantity: '3.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-01',
    username: 'PowerUser1',
    model: 'o3-mini',
    quantity: '2.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-01',
    username: 'PowerUser1',
    model: 'Code Review',
    quantity: '1.50',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-01',
    username: 'PowerUser1',
    model: 'gpt-4-vision',
    quantity: '2.50',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  },
  {
    date: '2025-06-02',
    username: 'RegularUser',
    model: 'gpt-4.1-2025-04-14',
    quantity: '1.00',
    exceeds_quota: 'false',
    total_monthly_quota: 'Unlimited'
  }
];
