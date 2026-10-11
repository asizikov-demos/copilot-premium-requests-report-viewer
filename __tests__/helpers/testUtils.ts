import { PRICING } from '@/constants/pricing';
import type { CSVData, ProcessedData } from '@/types/csv';
import { buildDateKeys } from '@/utils/dateKeys';

import { makeDailyBucketsArtifacts } from './makeArtifacts';

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

// Shared factory for ProcessedData test objects.
// Builds a complete, non-PII record with sensible defaults and derives the
// cached UTC keys (iso/dateKey/monthKey/epoch) from the timestamp via
// buildDateKeys so date handling stays UTC-safe. Any provided fields override
// the defaults, including extended billing fields.
export const makeProcessedData = (partial: Partial<ProcessedData> = {}): ProcessedData => {
  const timestamp = partial.timestamp ?? new Date('2025-06-01T00:00:00Z');
  const { iso, dateKey, monthKey, epoch } = buildDateKeys(timestamp);
  const quotaValue = partial.quotaValue ?? PRICING.BUSINESS_AI_CREDIT_QUOTA;
  const totalQuota = quotaValue === 'unknown' ? 'Unknown' : String(quotaValue);

  return {
    timestamp,
    user: 'test-user-one',
    model: 'test-model',
    creditsUsed: 0,
    totalQuota,
    quotaValue,
    unitType: 'ai-credits',
    usageUnit: 'ai_credit',
    iso,
    dateKey,
    monthKey,
    epoch,
    ...partial,
  };
};

export const buildMinimalDailyBucketsArtifact = (processed: ProcessedData[]) => {
  const monthsSet = new Set<string>();
  for (const row of processed) {
    monthsSet.add(row.monthKey || row.timestamp.toISOString().slice(0, 7));
  }

  return makeDailyBucketsArtifacts([], { months: Array.from(monthsSet).sort() });
};
