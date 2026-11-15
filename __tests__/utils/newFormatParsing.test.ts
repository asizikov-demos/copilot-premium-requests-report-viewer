import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';
import { normalizeRow } from '@/utils/ingestion/normalizeRow';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { newFormatRows } from '../fixtures/newFormatCSVData';
import { normalizeRows } from '../helpers/normalizeRows';

describe('AI-credit billing export', () => {
  it('maps quantity, net billing, quota, and organization without request conversion', () => {
    const processed = normalizeRows(newFormatRows);
    expect(processed).toHaveLength(2);
    expect(processed[0]).toMatchObject({
      user: 'test-user-one',
      model: 'Claude Sonnet 4',
      quantity: 3.6,
      billingQuantity: 3.6,
      usageUnit: 'ai_credit',
      quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      quotaRaw: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
      product: 'copilot',
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one',
      appliedCostPerQuantity: PRICING.AI_CREDIT_USD_VALUE,
      netAmount: 0.036,
    });
    expect(processed[0].day).toBe('2025-10-01');
    expect(processed[1]).toMatchObject({
      user: 'test-user-two',
      quantity: 12,
      quotaValue: 'unknown',
      quotaRaw: 'Unknown',
    });
  });

  it('normalizes US dates to UTC and retains fractional AI credits', () => {
    const processed = normalizeRows([{
      date: '5/29/26',
      username: 'test-user-one',
      product: 'copilot',
      sku: 'copilot_ai_credit',
      model: 'Auto: Claude Haiku 4.5',
      quantity: '96.9990345',
      unit_type: 'ai-credits',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
      gross_amount: '0.969990345',
      net_amount: '0.12',
      input: '100',
      output: '50',
      cache_read: '1000',
    }]);

    expect(processed[0].day).toBe('2026-05-29');
    expect(processed[0].day.slice(0, 7)).toBe('2026-05');
    expect(processed[0].quantity).toBeCloseTo(96.9990345);
    expect(processed[0].aicQuantity).toBeCloseTo(96.9990345);
    expect(processed[0].netAmount).toBe(0.12);
    expect(processed[0].inputTokens).toBe(100);
    expect(processed[0].outputTokens).toBe(50);
    expect(processed[0].cacheReadTokens).toBe(1000);
  });

  it('uses primary billing quantity and gross even when legacy AIC fields disagree', () => {
    const processed = normalizeRows([{
      date: '2026-06-01',
      username: 'test-user-one',
      product: 'copilot',
      sku: 'copilot_ai_credit',
      model: 'Auto: GPT-5.3-Codex',
      quantity: '42.726213',
      unit_type: 'ai-credits',
      gross_amount: '0.42726213',
      discount_amount: '0.32726213',
      net_amount: '0.1',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
      aic_quantity: '999',
      aic_gross_amount: '999',
    }]);
    expect(processed[0]).toMatchObject({
      quantity: 42.726213,
      billingQuantity: 42.726213,
      aicQuantity: 42.726213,
      aicGrossAmount: 0.42726213,
      netAmount: 0.1,
    });
  });

  it('retains unattributed AI credits as a special bucket', () => {
    const processed = normalizeRows([{
      date: '2026-07-01',
      username: '',
      product: 'copilot',
      sku: 'copilot_ai_credit',
      model: 'Code Review model',
      quantity: '12.5',
      unit_type: 'ai-credits',
      gross_amount: '0.125',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
    }]);
    expect(processed[0]).toMatchObject({
      user: '',
      quantity: 12.5,
      aicQuantity: 12.5,
      usageBucket: 'unattributed_ai_credit',
      isUnattributedUsage: true,
      quotaValue: 0,
    });
  });

  it('rejects request-unit rows, even when a supplemental AI-credit quantity exists', () => {
    const warnings: string[] = [];
    const row: CSVData = {
      date: '2026-07-01',
      username: 'test-user-one',
      sku: 'copilot_premium_request',
      unit_type: 'requests',
      model: 'test-model',
      quantity: '2',
      aic_quantity: '8.5',
    };
    expect(normalizeRow(row, warnings)).toBeNull();
    expect(normalizeRows([row])).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('Unsupported usage unit')]);
  });

  it('warns and skips malformed dates without throwing', () => {
    const warnings: string[] = [];
    expect(normalizeRow({
      date: 'not-a-date',
      username: 'test-user-one',
      model: 'test-model',
      quantity: '2',
      unit_type: 'ai-credits',
    }, warnings)).toBeNull();
    expect(warnings).toEqual(['Unrecognized date format for user=test-user-one date=not-a-date']);
  });

  it('trims usernames during normalization', () => {
    const rows: CSVData[] = [{
      ...newFormatRows[0],
      username: ' test-user-one ',
    }];
    const warnings: string[] = [];
    const normalized = rows.map(row => normalizeRow(row, warnings))
      .filter((row): row is NormalizedRow => row !== null);
    expect(warnings).toEqual([]);
    expect(normalized[0].user).toBe('test-user-one');
  });
});
