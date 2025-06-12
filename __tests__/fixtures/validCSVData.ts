import { CSVData } from '@/types/csv';

export const validCSVData: CSVData[] = [
  {
    Timestamp: '2025-06-03T11:05:27Z',
    User: 'TJGriff',
    Model: 'gpt-4.1-2025-04-14',
    'Requests Used': '1.00',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-03T14:22:15Z',
    User: 'JohnDoe',
    Model: 'claude-3.7-sonnet-thought',
    'Requests Used': '2.50',
    'Exceeds Monthly Quota': 'true',
    'Total Monthly Quota': '100'
  },
  {
    Timestamp: '2025-06-04T09:15:30Z',
    User: 'AliceSmith',
    Model: 'gemini-2.0-flash',
    'Requests Used': '0.75',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-04T16:45:12Z',
    User: 'TJGriff',
    Model: 'o3-mini',
    'Requests Used': '1.25',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  }
];

export const validCSVString = `Timestamp,User,Model,Requests Used,Exceeds Monthly Quota,Total Monthly Quota
2025-06-03T11:05:27Z,TJGriff,gpt-4.1-2025-04-14,1.00,false,Unlimited
2025-06-03T14:22:15Z,JohnDoe,claude-3.7-sonnet-thought,2.50,true,100
2025-06-04T09:15:30Z,AliceSmith,gemini-2.0-flash,0.75,false,Unlimited
2025-06-04T16:45:12Z,TJGriff,o3-mini,1.25,false,Unlimited`;

export const powerUserCSVData: CSVData[] = [
  {
    Timestamp: '2025-06-01T10:00:00Z',
    User: 'PowerUser1',
    Model: 'gpt-4.5',
    'Requests Used': '5.00',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-01T11:00:00Z',
    User: 'PowerUser1',
    Model: 'claude-3.7-sonnet-thought',
    'Requests Used': '8.00',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-01T12:00:00Z',
    User: 'PowerUser1',
    Model: 'gemini-2.0-flash',
    'Requests Used': '3.00',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-01T13:00:00Z',
    User: 'PowerUser1',
    Model: 'o3-mini',
    'Requests Used': '2.00',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-01T14:00:00Z',
    User: 'PowerUser1',
    Model: 'Code Review',
    'Requests Used': '1.50',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-01T15:00:00Z',
    User: 'PowerUser1',
    Model: 'gpt-4-vision',
    'Requests Used': '2.50',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  },
  {
    Timestamp: '2025-06-02T10:00:00Z',
    User: 'RegularUser',
    Model: 'gpt-4.1-2025-04-14',
    'Requests Used': '1.00',
    'Exceeds Monthly Quota': 'false',
    'Total Monthly Quota': 'Unlimited'
  }
];
