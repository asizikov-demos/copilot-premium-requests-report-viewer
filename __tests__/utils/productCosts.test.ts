import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import { aggregateProductCosts } from '@/utils/productCosts';

import { makeProcessedData } from '../helpers/testUtils';

const PRODUCT_COST_ROW_DEFAULTS = {
  timestamp: new Date('2025-10-01T00:00:00Z'),
  model: 'Claude Sonnet 4',
  requestsUsed: 1,
  quotaValue: PRICING.ENTERPRISE_QUOTA,
  grossAmount: 0.04,
  discountAmount: 0,
  netAmount: 0.04,
} satisfies Partial<ProcessedData>;

describe('aggregateProductCosts', () => {
  test('aggregates rows in stable product order with display labels', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'copilot', sku: 'copilot_premium_request', model: 'Claude Sonnet 4', requestsUsed: 2, grossAmount: 0.08, netAmount: 0.08, aicQuantity: 12.5, aicGrossAmount: 0.125 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'spark', sku: 'spark_premium_request', model: 'Claude Sonnet 4.5', requestsUsed: 3, grossAmount: 0.12, netAmount: 0.12 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, model: 'Coding Agent model', requestsUsed: 4, grossAmount: 0.16, netAmount: 0.16 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, model: 'Code Review model', requestsUsed: 5, grossAmount: 0.2, netAmount: 0.2 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, user: '', model: 'Code Review', requestsUsed: 6, grossAmount: 0.24, netAmount: 0.24, isNonCopilotUsage: true, usageBucket: 'non_copilot_code_review' }),
    ];

    expect(aggregateProductCosts(rows)).toEqual([
      expect.objectContaining({ category: 'Copilot', label: 'Copilot', requests: 2, aicQuantity: 12.5, aicGrossAmount: 0.125 }),
      expect.objectContaining({ category: 'Spark', label: 'Spark', requests: 3 }),
      expect.objectContaining({ category: 'Coding Agent', label: 'Cloud Agent', requests: 4 }),
      expect.objectContaining({ category: 'Code Review', label: 'Code Review', requests: 5 }),
      expect.objectContaining({ category: 'Code Review for Non-Copilot Users', label: 'Code Review for Non-Copilot Users', requests: 6 }),
    ]);
  });
});
