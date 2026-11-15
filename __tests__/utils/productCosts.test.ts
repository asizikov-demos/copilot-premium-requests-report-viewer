import { PRICING } from '@/constants/pricing';
import type { NormalizedRow } from '@/utils/ingestion/types';
import { aggregateProductCosts as selectProductCosts } from '@/utils/productCosts';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';
import { makeModelDailyArtifacts } from '../helpers/modelDailyArtifacts';

function aggregateProductCosts(rows: NormalizedRow[]) {
  return selectProductCosts(makeModelDailyArtifacts(rows).productCosts);
}

const PRODUCT_COST_ROW_DEFAULTS = {
  day: '2025-10-01',
  model: 'Claude Sonnet 4',
  quantity: 1,
  quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
  grossAmount: 0.04,
  discountAmount: 0,
  netAmount: 0.04,
} satisfies Partial<NormalizedRow>;

describe('aggregateProductCosts', () => {
  test('aggregates rows in stable product order with display labels', () => {
    const rows: NormalizedRow[] = [
      makeNormalizedRow({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'copilot', sku: 'copilot_ai_credit', model: 'Claude Sonnet 4', quantity: 2, grossAmount: 0.08, netAmount: 0.08, aicQuantity: 12.5, aicGrossAmount: 0.125 }),
      makeNormalizedRow({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'spark', sku: 'copilot_ai_credit', model: 'Claude Sonnet 4.5', quantity: 3, grossAmount: 0.12, netAmount: 0.12 }),
      makeNormalizedRow({ ...PRODUCT_COST_ROW_DEFAULTS, model: 'Coding Agent model', quantity: 4, grossAmount: 0.16, netAmount: 0.16 }),
      makeNormalizedRow({ ...PRODUCT_COST_ROW_DEFAULTS, model: 'Claude Sonnet 5', sku: 'coding_agent_ai_credit', quantity: 7, grossAmount: 0.07, netAmount: 0.07 }),
      makeNormalizedRow({ ...PRODUCT_COST_ROW_DEFAULTS, model: 'Code Review model', quantity: 5, grossAmount: 0.2, netAmount: 0.2 }),
      makeNormalizedRow({ ...PRODUCT_COST_ROW_DEFAULTS, product: 'code_quality', sku: 'code_quality_ai_credit', model: 'Claude Sonnet 4.6', quantity: 51.28584, grossAmount: 0.5128584, netAmount: 0.5128584 }),
      makeNormalizedRow({ ...PRODUCT_COST_ROW_DEFAULTS, user: '', model: 'Code Review', quantity: 6, grossAmount: 0.24, netAmount: 0.24, isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit' }),
    ];

    expect(aggregateProductCosts(rows)).toEqual([
      expect.objectContaining({ category: 'Copilot', label: 'Copilot', credits: 2, aicQuantity: 12.5, aicGrossAmount: 0.125 }),
      expect.objectContaining({ category: 'Spark', label: 'Spark', credits: 3 }),
      expect.objectContaining({ category: 'Coding Agent', label: 'Cloud Agent', credits: 11 }),
      expect.objectContaining({ category: 'Code Review', label: 'Code Review', credits: 11 }),
      expect.objectContaining({ category: 'Code Quality', label: 'Code Quality', credits: 51.28584 }),
    ]);
  });
});
