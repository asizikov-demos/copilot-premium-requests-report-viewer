import type { CSVData } from '@/types/csv';

export { makeUsageRow } from './makeNormalizedRow';

export const createMockFile = (content: string, name: string, type: string = 'text/csv') => {
  return new File([content], name, { type });
};

export const createMockCSVData = (overrides: Partial<CSVData> = {}): CSVData => ({
  date: '2025-06-03',
  username: 'test-user-one',
  product: 'copilot',
  sku: 'copilot_ai_credit',
  unit_type: 'ai-credits',
  model: 'test-model',
  quantity: '1.00',
  total_monthly_quota: 'Unknown',
  ...overrides
});
