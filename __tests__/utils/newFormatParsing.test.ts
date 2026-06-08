import { buildProcessedDataLegacy } from '@/utils/ingestion/adapter';
import { buildProcessedDataFromRows } from '@/utils/ingestion/adapters';
import { normalizeRow } from '@/utils/ingestion/normalizeRow';
import type { CSVData } from '@/types/csv';
import type { NormalizedRow } from '@/utils/ingestion/types';

import { processCSVData } from '../helpers/processCSVData';
import { newFormatRows } from '../fixtures/newFormatCSVData';

describe('processCSVData (CSV format)', () => {
  it('maps CSV rows into ProcessedData correctly', () => {
    const processed = processCSVData(newFormatRows);
    expect(processed).toHaveLength(2);

    const first = processed[0];
    expect(first.user).toBe('alice');
    expect(first.model).toBe('Claude Sonnet 4');
    expect(first.requestsUsed).toBeCloseTo(3.6);
    expect(first.exceedsQuota).toBe(false);
    expect(first.quotaValue).toBe(1000);
    expect(first.totalQuota).toBe('1000');
    expect(first.timestamp.toISOString()).toBe('2025-10-01T00:00:00.000Z');
    expect(first.product).toBe('copilot');
    expect(first.organization).toBe('org-alpha');
    expect(first.appliedCostPerQuantity).toBeCloseTo(0.04);
    expect(first.netAmount).toBeCloseTo(0.144);

    const second = processed[1];
    expect(second.user).toBe('bob');
    expect(second.quotaValue).toBe('unknown');
    expect(second.totalQuota.toLowerCase()).toBe('unknown');
    expect(second.timestamp.toISOString()).toBe('2025-10-02T00:00:00.000Z');
    expect(second.requestsUsed).toBe(12);
  });

  it('handles mixed numeric formatting & boolean normalization', () => {
    const processed = processCSVData(newFormatRows);
    processed.forEach(r => {
      expect(typeof r.requestsUsed).toBe('number');
      expect(typeof r.exceedsQuota).toBe('boolean');
    });
  });

  it('converts US M/D/YY dates (newer AI Usage report) into valid UTC timestamps', () => {
    const rows: CSVData[] = [
      {
        date: '5/29/26',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Auto: Claude Haiku 4.5',
        quantity: '96.9990345',
        unit_type: 'ai-credits',
        applied_cost_per_quantity: '0.01',
        gross_amount: '0.969990345',
        discount_amount: '0',
        net_amount: '0.969990345',
        total_monthly_quota: '3900',
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
        aic_quantity: '96.9990345',
        aic_gross_amount: '0.969990345',
      },
    ];

    const processed = processCSVData(rows);
    expect(processed).toHaveLength(1);
    expect(processed[0].timestamp.toISOString()).toBe('2026-05-29T00:00:00.000Z');
    expect(processed[0].dateKey).toBe('2026-05-29');
    expect(processed[0].monthKey).toBe('2026-05');
    expect(processed[0].requestsUsed).toBe(0);
    expect(processed[0].billingQuantity).toBeCloseTo(96.9990345);
    expect(processed[0].aicQuantity).toBeCloseTo(96.9990345);
  });

  it('supports current usage-based AI Credits billing rows using primary billing fields', () => {
    const rows: CSVData[] = [
      {
        date: '2026-06-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Auto: Claude Haiku 4.5',
        quantity: '42.726213',
        unit_type: 'ai-credits',
        applied_cost_per_quantity: '0.01',
        gross_amount: '0.4272621300000001',
        discount_amount: '0.4272621300000001',
        net_amount: '0',
        total_monthly_quota: '3900',
        organization: 'test-org-one',
        cost_center_name: '',
        aic_quantity: '999',
        aic_gross_amount: '999',
      },
      {
        date: '2026-06-01',
        username: 'test-user-two',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Auto: GPT-5.3-Codex',
        quantity: '5.447169000000001',
        unit_type: 'ai-credit',
        applied_cost_per_quantity: '0.01',
        gross_amount: '0.054471689999999996',
        discount_amount: '0.054471689999999996',
        net_amount: '0',
        total_monthly_quota: '1900',
        organization: 'test-org-two',
        cost_center_name: '',
        aic_quantity: '888',
        aic_gross_amount: '888',
      },
    ];

    const processed = processCSVData(rows);

    expect(processed).toHaveLength(2);
    expect(processed[0]).toMatchObject({
      requestsUsed: 0,
      billingQuantity: 42.726213,
      usageUnit: 'ai_credit',
      quotaValue: 3900,
      grossAmount: 0.4272621300000001,
      discountAmount: 0.4272621300000001,
      netAmount: 0,
      aicQuantity: 42.726213,
      aicGrossAmount: 0.4272621300000001,
    });
    expect(processed[1].quotaValue).toBe(1900);
    expect(processed[1].aicQuantity).toBeCloseTo(5.447169);
    expect(processed[1].aicGrossAmount).toBeCloseTo(0.05447169);
  });

  it('maps AI Credits fields from the billing report', () => {
    const rows: CSVData[] = [
      {
        date: '2026-03-01',
        username: 'test-user-a',
        product: 'copilot',
        sku: 'coding_agent_premium_request',
        model: 'Coding Agent model',
        quantity: '2',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.08',
        discount_amount: '0.08',
        net_amount: '0',
        organization: 'example-org-a',
        cost_center_name: '',
        aic_quantity: '8.68986',
        aic_gross_amount: '0.08689859999999999',
      },
    ];

    const processed = processCSVData(rows);
    expect(processed[0].aicQuantity).toBeCloseTo(8.68986);
    expect(processed[0].aicGrossAmount).toBeCloseTo(0.0868986);
  });

  it('zeros request quantity and PRU billing fields for non-request unit types', () => {
    const rows: CSVData[] = [
      {
        date: '2026-03-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_premium_request',
        unit_type: 'new-unit',
        model: 'Claude Sonnet 4',
        quantity: '12',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.48',
        discount_amount: '0.08',
        net_amount: '0.40',
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
        aic_quantity: '3.5',
        aic_gross_amount: '0.035',
      },
      {
        date: '2026-03-01',
        username: 'test-user-two',
        product: 'copilot',
        sku: 'copilot_premium_request',
        unit_type: 'requests',
        model: 'Claude Sonnet 4',
        quantity: '2',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.08',
        discount_amount: '0.01',
        net_amount: '0.07',
      },
    ];

    const processed = processCSVData(rows);

    expect(processed[0]).toMatchObject({
      user: 'test-user-one',
      requestsUsed: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 3.5,
      aicGrossAmount: 0.035,
    });
    expect(processed[1]).toMatchObject({
      user: 'test-user-two',
      requestsUsed: 2,
      grossAmount: 0.08,
      discountAmount: 0.01,
      netAmount: 0.07,
    });
  });

  it('maps blank-username Code Review rows into a non-Copilot usage bucket with zero quota', () => {
    const processed = processCSVData([
      ...newFormatRows,
      {
        date: '2025-10-03',
        username: '   ',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Code Review',
        quantity: '4',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        organization: 'org-gamma',
        cost_center_name: 'CC-Gamma'
      }
    ]);

    const special = processed[2];
    expect(special.user).toBe('');
    expect(special.isNonCopilotUsage).toBe(true);
    expect(special.usageBucket).toBe('non_copilot_code_review');
    expect(special.quotaValue).toBe(0);
    expect(special.totalQuota).toBe('0');
  });

  it('reconstructs timestamps from the normalized UTC day', () => {
    const rows: NormalizedRow[] = [{
      date: '5/29/26',
      day: '2026-05-29',
      user: 'test-user-one',
      model: 'Claude Sonnet 4',
      quantity: 2,
      quotaRaw: '1000',
      quotaValue: 1000,
      exceedsQuota: false,
      product: 'copilot',
      sku: 'copilot_premium_request',
    }];

    const processed = buildProcessedDataFromRows(rows);

    expect(processed).toHaveLength(1);
    expect(processed[0].timestamp.toISOString()).toBe('2026-05-29T00:00:00.000Z');
    expect(processed[0].dateKey).toBe('2026-05-29');
    expect(processed[0].monthKey).toBe('2026-05');
  });

  it('skips malformed adapter row dates with a warning instead of throwing', () => {
    const warnings: string[] = [];
    const rows: NormalizedRow[] = [{
      date: 'not-a-date',
      day: 'not-a-date',
      user: 'test-user-one',
      model: 'Claude Sonnet 4',
      quantity: 2,
    }];

    expect(buildProcessedDataFromRows(rows, warnings)).toEqual([]);
    expect(warnings).toEqual(['Unrecognized date format for user=test-user-one date=not-a-date']);
  });

  it('keeps legacy CSV wrappers aligned with the normalized conversion path', () => {
    const rows: CSVData[] = [{
      date: '2025-10-04',
      username: ' test-user-one ',
      product: 'copilot',
      sku: 'copilot_premium_request',
      model: 'Claude Sonnet 4',
      quantity: '2.5',
      exceeds_quota: 'TRUE',
      total_monthly_quota: '300',
      applied_cost_per_quantity: '0.04',
      gross_amount: '0.10',
      discount_amount: '0.01',
      net_amount: '0.09',
      organization: 'test-org-one',
      cost_center_name: 'test-cost-center-one'
    }];
    const warnings: string[] = [];
    const normalizedRows = rows
      .map(row => normalizeRow(row, warnings))
      .filter((row): row is NormalizedRow => row !== null);
    const canonical = buildProcessedDataFromRows(normalizedRows);

    expect(warnings).toEqual([]);
    expect(rows[0].username).toBe(' test-user-one ');
    expect(processCSVData(rows)).toEqual(canonical);
    expect(buildProcessedDataLegacy(rows)).toEqual(canonical);
    expect(canonical[0].user).toBe('test-user-one');
    expect(canonical[0]).toMatchObject({
      user: 'test-user-one',
      requestsUsed: 2.5,
      billingQuantity: 2.5,
      usageUnit: 'request',
      exceedsQuota: true,
      quotaValue: 300,
      totalQuota: '300',
      grossAmount: 0.10,
      netAmount: 0.09,
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one'
    });
    expect(canonical[0].timestamp.toISOString()).toBe('2025-10-04T00:00:00.000Z');
  });
});
