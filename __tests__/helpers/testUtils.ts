import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

import type { DailyBucketsArtifacts } from '@/utils/ingestion';
import type { CSVData, ProcessedData } from '@/types/csv';

// Custom render function with providers if needed
export const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { ...options });

export const createMockFile = (content: string, name: string, type: string = 'text/csv') => {
  return new File([content], name, { type });
};

export const createMockCSVData = (overrides: Partial<CSVData> = {}): CSVData => ({
  date: '2025-06-03',
  username: 'test-user',
  model: 'test-model',
  quantity: '1.00',
  exceeds_quota: 'false',
  total_monthly_quota: 'Unlimited',
  ...overrides
});

// Helper to create multiple mock CSV entries
export const createMockCSVDataArray = (count: number, overrides: Partial<CSVData> = {}): CSVData[] => {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(2025, 5, 3 + index);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    return createMockCSVData({
      ...overrides,
      username: `test-user-${index + 1}`,
      date: dateStr,
      quantity: (Math.random() * 5).toFixed(2)
    });
  });
};

export const buildMinimalDailyBucketsArtifact = (processed: ProcessedData[]): DailyBucketsArtifacts => {
  const monthsSet = new Set<string>();
  for (const row of processed) {
    monthsSet.add(row.monthKey || row.timestamp.toISOString().slice(0, 7));
  }

  return { dailyUserTotals: new Map(), dateRange: null, months: Array.from(monthsSet).sort() };
};

export const filterBySelectedMonths = (data: ProcessedData[], selected: string[]): ProcessedData[] => {
  if (selected.length === 0) return data;
  const set = new Set(selected);
  return data.filter(d => {
    const monthKey = d.monthKey || d.timestamp.toISOString().slice(0, 7);
    return set.has(monthKey);
  });
};
