import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';
import { buildProcessedDataFromRawRows, buildProcessedDataFromRows } from '@/utils/ingestion';
import { normalizeRow } from '@/utils/ingestion/normalizeRow';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { newFormatRows } from '../fixtures/newFormatCSVData';
import { processCSVData } from '../helpers/processCSVData';

describe('AI-credit billing export', () => {
  it('maps quantity, net billing, quota, and organization without request conversion', () => {
    const processed = processCSVData(newFormatRows);
    expect(processed).toHaveLength(2);
    expect(processed[0]).toMatchObject({
      user: 'test-user-one',
      model: 'Claude Sonnet 4',
      creditsUsed: 3.6,
      billingQuantity: 3.6,
      usageUnit: 'ai_credit',
      quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      totalQuota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
      product: 'copilot',
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one',
      appliedCostPerQuantity: PRICING.AI_CREDIT_USD_VALUE,
      netAmount: 0.036,
    });
    expect(processed[0].timestamp.toISOString()).toBe('2025-10-01T00:00:00.000Z');
    expect(processed[1]).toMatchObject({
      user: 'test-user-two',
      creditsUsed: 12,
      quotaValue: 'unknown',
      totalQuota: 'Unknown',
    });
  });

  it('normalizes US dates to UTC and retains fractional AI credits', () => {
    const processed = processCSVData([{
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

    expect(processed[0].dateKey).toBe('2026-05-29');
    expect(processed[0].monthKey).toBe('2026-05');
    expect(processed[0].creditsUsed).toBeCloseTo(96.9990345);
    expect(processed[0].aicQuantity).toBeCloseTo(96.9990345);
    expect(processed[0].netAmount).toBe(0.12);
    expect(processed[0].inputTokens).toBe(100);
    expect(processed[0].outputTokens).toBe(50);
    expect(processed[0].cacheReadTokens).toBe(1000);
  });

  it('uses primary billing quantity and gross even when legacy AIC fields disagree', () => {
    const processed = processCSVData([{
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
      creditsUsed: 42.726213,
      billingQuantity: 42.726213,
      aicQuantity: 42.726213,
      aicGrossAmount: 0.42726213,
      netAmount: 0.1,
    });
  });

  it('retains unattributed AI credits as a special bucket', () => {
    const processed = processCSVData([{
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
      creditsUsed: 12.5,
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
    expect(buildProcessedDataFromRawRows([row])).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('Unsupported usage unit')]);
  });

  it('reconstructs timestamps from normalized UTC days', () => {
    const rows: NormalizedRow[] = [{
      date: '5/29/26',
      day: '2026-05-29',
      user: 'test-user-one',
      model: 'test-model',
      quantity: 2,
      quotaRaw: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
      quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      usageUnit: 'ai_credit',
    }];
    expect(buildProcessedDataFromRows(rows)[0]).toMatchObject({
      dateKey: '2026-05-29',
      monthKey: '2026-05',
      creditsUsed: 2,
    });
  });

  it('warns and skips malformed dates without throwing', () => {
    const warnings: string[] = [];
    expect(buildProcessedDataFromRows([{
      date: 'not-a-date',
      day: 'not-a-date',
      user: 'test-user-one',
      model: 'test-model',
      quantity: 2,
    }], warnings)).toEqual([]);
    expect(warnings).toEqual(['Unrecognized date format for user=test-user-one date=not-a-date']);
  });

  it('keeps raw CSV wrappers aligned with normalized conversion', () => {
    const rows: CSVData[] = [{
      ...newFormatRows[0],
      username: ' test-user-one ',
    }];
    const warnings: string[] = [];
    const normalized = rows.map(row => normalizeRow(row, warnings))
      .filter((row): row is NormalizedRow => row !== null);
    const canonical = buildProcessedDataFromRows(normalized);
    expect(warnings).toEqual([]);
    expect(processCSVData(rows)).toEqual(canonical);
    expect(buildProcessedDataFromRawRows(rows)).toEqual(canonical);
    expect(canonical[0].user).toBe('test-user-one');
  });
});
