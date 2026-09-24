import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import { aggregateAutoModeSavings, getAutoModeBaseModel } from '@/utils/autoModeSavings';

import { makeProcessedData } from '../helpers/testUtils';

const AUTO_MODE_ROW_DEFAULTS = {
  timestamp: new Date('2026-04-01T00:00:00Z'),
  model: 'Auto: GPT-5.3-Codex',
  creditsUsed: 0.9,
  appliedCostPerQuantity: PRICING.AI_CREDIT_USD_VALUE,
  grossAmount: 0.9 * PRICING.AI_CREDIT_USD_VALUE,
  discountAmount: 0,
  netAmount: 0.9 * PRICING.AI_CREDIT_USD_VALUE,
} satisfies Partial<ProcessedData>;

describe('Auto Mode savings', () => {
  it('strips the Auto label from model names', () => {
    expect(getAutoModeBaseModel('Auto: GPT-5.3-Codex')).toBe('GPT-5.3-Codex');
    expect(getAutoModeBaseModel('auto: Claude Sonnet')).toBe('Claude Sonnet');
    expect(getAutoModeBaseModel('Claude Sonnet')).toBeNull();
  });

  it('aggregates Auto rows using billed AI credits and savings', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({ ...AUTO_MODE_ROW_DEFAULTS, creditsUsed: 0.9, grossAmount: .9 * PRICING.AI_CREDIT_USD_VALUE, netAmount: .9 * PRICING.AI_CREDIT_USD_VALUE }),
      makeProcessedData({ ...AUTO_MODE_ROW_DEFAULTS, creditsUsed: 1.8, grossAmount: 1.8 * PRICING.AI_CREDIT_USD_VALUE, netAmount: 1.8 * PRICING.AI_CREDIT_USD_VALUE }),
      makeProcessedData({ ...AUTO_MODE_ROW_DEFAULTS, model: 'Claude Sonnet 4', creditsUsed: 5, grossAmount: 5 * PRICING.AI_CREDIT_USD_VALUE, netAmount: 5 * PRICING.AI_CREDIT_USD_VALUE }),
    ];

    const [result] = aggregateAutoModeSavings(rows);

    expect(result.model).toBe('GPT-5.3-Codex');
    expect(result.quantity).toBeCloseTo(2.7);
    expect(result.costBeforeAuto).toBeCloseTo(2.7 * PRICING.AI_CREDIT_USD_VALUE / (1 - PRICING.AUTO_MODE_DISCOUNT_RATE));
    expect(result.savings).toBeCloseTo(result.costBeforeAuto - 2.7 * PRICING.AI_CREDIT_USD_VALUE);
  });

  it('does not invent savings when billing cost fields are absent', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({
        ...AUTO_MODE_ROW_DEFAULTS,
        creditsUsed: 0.9,
        appliedCostPerQuantity: undefined,
        grossAmount: undefined,
        netAmount: undefined,
      }),
    ];

    expect(aggregateAutoModeSavings(rows)).toEqual([]);
  });

  it('does not treat unrelated billing discounts as Auto Mode savings', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({
        ...AUTO_MODE_ROW_DEFAULTS,
        creditsUsed: 553.5,
        grossAmount: 22.14,
        netAmount: 3.32,
      }),
    ];

    const [result] = aggregateAutoModeSavings(rows);

    expect(result.quantity).toBeCloseTo(553.5);
    expect(result.costBeforeAuto).toBeCloseTo(22.14 / (1 - PRICING.AUTO_MODE_DISCOUNT_RATE));
    expect(result.savings).toBeCloseTo(result.costBeforeAuto - 22.14);
  });

  it('aggregates usage-based Auto rows in AI Credits', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({
        ...AUTO_MODE_ROW_DEFAULTS,
        creditsUsed: 100,
        usageUnit: 'ai_credit',
        billingQuantity: 100,
        aicQuantity: 100,
        appliedCostPerQuantity: PRICING.AI_CREDIT_USD_VALUE,
        grossAmount: 1,
        discountAmount: 1,
        netAmount: 0,
      }),
    ];

    const [result] = aggregateAutoModeSavings(rows);

    expect(result.model).toBe('GPT-5.3-Codex');
    expect(result.quantity).toBeCloseTo(100);
    expect(result.costBeforeAuto).toBeCloseTo(1 / (1 - PRICING.AUTO_MODE_DISCOUNT_RATE));
    expect(result.savings).toBeCloseTo(result.costBeforeAuto - 1);
  });

  it('does not estimate Auto savings from a unit price without a billed gross amount', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({
        ...AUTO_MODE_ROW_DEFAULTS,
        creditsUsed: 100,
        usageUnit: 'ai_credit',
        billingQuantity: 100,
        aicQuantity: 100,
        appliedCostPerQuantity: PRICING.AI_CREDIT_USD_VALUE,
        grossAmount: undefined,
        netAmount: 1,
      }),
    ];

    expect(aggregateAutoModeSavings(rows)).toEqual([]);
  });

  it('retains reported zero gross without inventing a billed cost or savings', () => {
    const [result] = aggregateAutoModeSavings([
      makeProcessedData({
        ...AUTO_MODE_ROW_DEFAULTS,
        creditsUsed: 10,
        grossAmount: 0,
        netAmount: 0,
      }),
    ]);

    expect(result).toEqual({
      model: 'GPT-5.3-Codex',
      quantity: 10,
      costBeforeAuto: 0,
      savings: 0,
    });
  });

  it('keeps consumed AI credits separate from the before-Auto undiscounted cost', () => {
    const rows: ProcessedData[] = [
      makeProcessedData({
        ...AUTO_MODE_ROW_DEFAULTS,
        creditsUsed: 21404.23,
        usageUnit: 'ai_credit',
        billingQuantity: 21404.23,
        aicQuantity: 21404.23,
        grossAmount: 21404.23 * PRICING.AI_CREDIT_USD_VALUE,
      }),
    ];

    const [result] = aggregateAutoModeSavings(rows);

    expect(result.quantity).toBeCloseTo(21404.23);
    expect(result.costBeforeAuto).toBeCloseTo(
      21404.23 * PRICING.AI_CREDIT_USD_VALUE / (1 - PRICING.AUTO_MODE_DISCOUNT_RATE)
    );
    expect(result.savings).toBeCloseTo(result.costBeforeAuto - 21404.23 * PRICING.AI_CREDIT_USD_VALUE);
  });
});
