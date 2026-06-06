import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

import { PRICING } from '@/constants/pricing';
import type { DailyBucketsArtifacts } from '@/utils/ingestion';
import type { CSVData, ProcessedData } from '@/types/csv';
import { buildDateKeys } from '@/utils/dateKeys';

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
  total_monthly_quota: 'Unknown',
  ...overrides
});

// Shared factory for ProcessedData test objects.
// Builds a complete, non-PII record with sensible defaults and derives the
// cached UTC keys (iso/dateKey/monthKey/epoch) from the timestamp via
// buildDateKeys so date handling stays UTC-safe. Any provided fields override
// the defaults, including extended billing fields.
export const makeProcessedData = (partial: Partial<ProcessedData> = {}): ProcessedData => {
  const timestamp = partial.timestamp ?? new Date('2025-06-01T00:00:00Z');
  const { iso, dateKey, monthKey, epoch } = buildDateKeys(timestamp);
  const quotaValue = partial.quotaValue ?? PRICING.BUSINESS_QUOTA;
  const totalQuota = quotaValue === 'unknown' ? 'Unknown' : String(quotaValue);

  return {
    timestamp,
    user: 'test-user-one',
    model: 'test-model',
    requestsUsed: 0,
    exceedsQuota: false,
    totalQuota,
    quotaValue,
    unitType: 'requests',
    iso,
    dateKey,
    monthKey,
    epoch,
    ...partial,
  };
};

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
