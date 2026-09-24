import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import { aggregateProductCosts } from '@/utils/productCosts';

import { makeProcessedData } from '../helpers/testUtils';

const PRODUCT_COST_ROW_DEFAULTS = {
  timestamp: new Date('2025-10-01T00:00:00Z'),
  model: 'Claude Sonnet 4',
  creditsUsed: 1,
  quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
  grossAmount: 0.04,
  discountAmount: 0,
  netAmount: 0.04,
} satisfies Partial<ProcessedData>;

describe('aggregateProductCosts', () => {
  test('aggregates rows in stable product order with display labels', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'copilot', sku: 'copilot_ai_credit', model: 'Claude Sonnet 4', creditsUsed: 2, grossAmount: 0.08, netAmount: 0.08, aicQuantity: 12.5, aicGrossAmount: 0.125 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'spark', sku: 'copilot_ai_credit', model: 'Claude Sonnet 4.5', creditsUsed: 3, grossAmount: 0.12, netAmount: 0.12 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, model: 'Coding Agent model', creditsUsed: 4, grossAmount: 0.16, netAmount: 0.16 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, model: 'Code Review model', creditsUsed: 5, grossAmount: 0.2, netAmount: 0.2 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'code_quality', sku: 'code_quality_ai_credit', model: 'Claude Sonnet 4.6', creditsUsed: 51.28584, grossAmount: 0.5128584, netAmount: 0.5128584 }),
      makeProcessedData({ ...PRODUCT_COST_ROW_DEFAULTS, user: '', model: 'Code Review', creditsUsed: 6, grossAmount: 0.24, netAmount: 0.24, isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit' }),
    ];

    expect(aggregateProductCosts(rows)).toEqual([
      expect.objectContaining({ category: 'Copilot', label: 'Copilot', credits: 2, aicQuantity: 12.5, aicGrossAmount: 0.125 }),
      expect.objectContaining({ category: 'Spark', label: 'Spark', credits: 3 }),
      expect.objectContaining({ category: 'Coding Agent', label: 'Cloud Agent', credits: 4 }),
      expect.objectContaining({ category: 'Code Review', label: 'Code Review', credits: 11 }),
      expect.objectContaining({ category: 'Code Quality', label: 'Code Quality', credits: 51.28584 }),
    ]);
  });
});
