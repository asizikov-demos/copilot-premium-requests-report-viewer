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
