import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { CSVData } from '@/types/csv';

// Custom render function with providers if needed
export const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { ...options });

export const createMockFile = (content: string, name: string, type: string = 'text/csv') => {
  return new File([content], name, { type });
};

export const createMockCSVData = (overrides: Partial<CSVData> = {}): CSVData => ({
  Timestamp: '2025-06-03T11:05:27Z',
  User: 'TestUser',
  Model: 'test-model',
  'Requests Used': '1.00',
  'Exceeds Monthly Quota': 'false',
  'Total Monthly Quota': 'Unlimited',
  ...overrides
});

// Helper to create multiple mock CSV entries
export const createMockCSVDataArray = (count: number, overrides: Partial<CSVData> = {}): CSVData[] => {
  return Array.from({ length: count }, (_, index) => 
    createMockCSVData({
      ...overrides,
      User: `TestUser${index + 1}`,
      Timestamp: new Date(2025, 5, 3 + index, 10, 0, 0).toISOString(),
      'Requests Used': (Math.random() * 5).toFixed(2)
    })
  );
};
