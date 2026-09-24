import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { DataAnalysis } from '@/components/DataAnalysis';
import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';
import {
  BillingAggregator,
  DailyBucketsAggregator,
  FeatureUsageAggregator,
  QuotaAggregator,
  RawDataAggregator,
  UsageAggregator,
  normalizeRow,
} from '@/utils/ingestion';
import type { AggregatorContext, BillingArtifacts, IngestionResult, NormalizedRow, UsageArtifacts } from '@/utils/ingestion/types';

import { newFormatRows } from '../fixtures/newFormatCSVData';

// Mock ResizeObserver for Recharts ResponsiveContainer in JSDOM
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Helper to create IngestionResult from raw CSV rows
function createIngestionResultFromRawRows(rows: CSVData[]): IngestionResult {
  const warnings: string[] = [];
  const normalizedRows = rows
    .map(row => normalizeRow(row, warnings))
    .filter((row): row is NormalizedRow => row !== null);
  const aggregators = [
    new QuotaAggregator(),
    new UsageAggregator(),
    new DailyBucketsAggregator(),
    new FeatureUsageAggregator(),
    new BillingAggregator(),
    new RawDataAggregator(),
  ];
  const ctx: AggregatorContext = { pricing: PRICING };

  for (const aggregator of aggregators) {
    aggregator.init?.(ctx);
  }

  for (const row of normalizedRows) {
    for (const aggregator of aggregators) {
      aggregator.onRow(row, ctx);
    }
  }

  const outputs: Record<string, unknown> = {};
  for (const aggregator of aggregators) {
    outputs[aggregator.id] = aggregator.finalize(ctx);
  }

  return {
    outputs,
    rowsProcessed: normalizedRows.length,
    durationMs: 100,
    warnings
  };
}

function createIngestionResultWithBillingArtifacts(billingArtifacts: BillingArtifacts): IngestionResult {
  return {
    outputs: {
      'quota': { quotaByUser: new Map(), conflicts: new Map(), distinctQuotas: new Set(), hasMixedQuotas: false, hasMixedLicenses: false },
      'usage': { users: [], userTotals: new Map(), modelBreakdown: new Map(), globalModelTotals: new Map(), topModelPerUser: new Map(), modelTotals: {}, userCount: 0, modelCount: 0 },
      'dailyBuckets': { dailyUserTotals: new Map(), startDate: new Date(), endDate: new Date() },
      'featureUsage': {
        featureTotals: { codeReview: 0, codingAgent: 0, spark: 0, codeQuality: 0 },
        featureUsers: { codeReview: new Set(), codingAgent: new Set(), spark: new Set(), codeQuality: new Set() },
        specialTotals: { unattributedCodeReview: 0, unattributedCodeQuality: 0 }
      },
      'billing': billingArtifacts
    },
    rowsProcessed: 0,
    durationMs: 100,
    warnings: []
  };
}

describe('DataAnalysis billing summary', () => {
  it('renders billing summary when cost fields are present', async () => {
    const ingestionResult = createIngestionResultFromRawRows(newFormatRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    // Wait for provider effects & rendering. Billing summary may appear once processedData is built.
    await waitFor(() => {
      const billing = screen.getByLabelText('billing-summary');
      expect(billing).toBeInTheDocument();
      // New compact format uses abbreviated labels
      expect(billing).toHaveTextContent(/Gross/i);
      expect(billing).toHaveTextContent(/Additional usage/i);
    });

    expect(screen.queryByText('Usage-based billing preview')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'AI Usage' }).length).toBeGreaterThan(0);
  });

  it('renders supplied AI-credit billing totals without legacy pool estimates', async () => {
    const billingArtifacts: BillingArtifacts = {
      totals: {
        gross: 1,
        discount: 0,
        net: 1,
        aicQuantity: 100,
        aicGrossAmount: 1,
      },
      users: [],
      userMap: new Map(),
      orgTotals: new Map(),
      costCenterTotals: new Map(),
      billingByModel: new Map(),
      hasAnyBillingData: true,
      hasAnyAicData: true,
      specialBuckets: [],
    };
    const ingestionResult = createIngestionResultWithBillingArtifacts(billingArtifacts);

    render(<DataAnalysis ingestionResult={ingestionResult} filename="stored-billing.csv" onReset={() => {}} />);

    await waitFor(() => {
      const summary = screen.getByLabelText('billing-summary');
      expect(summary).toHaveTextContent('Gross cost');
      expect(summary).toHaveTextContent('$1.00');
      expect(summary).not.toHaveTextContent('additional usage gross');
    });
  });

  it('renders AI Credits callout and overview card when AIC fields are present', async () => {
    const aicRows: CSVData[] = [
      {
        date: '2026-03-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Coding Agent model',
        quantity: '2',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.08',
        discount_amount: '0.08',
        net_amount: '0',
        organization: 'test-org-one',
        cost_center_name: '',
        aic_quantity: '8.68986',
        aic_gross_amount: '0.08689859999999999',
      },
      {
        date: '2026-03-01',
        username: 'test-user-two',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Coding Agent model',
        quantity: '2',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.08',
        discount_amount: '0.08',
        net_amount: '0',
        organization: 'test-org-two',
        cost_center_name: 'test-cost-center-two',
        aic_quantity: '18.33306',
        aic_gross_amount: '0.1833306',
      },
      {
        date: '2026-03-02',
        username: 'test-user-three',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Claude Opus 4.6',
        quantity: '24',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.96',
        discount_amount: '0.96',
        net_amount: '0',
        organization: 'test-org-three',
        cost_center_name: '',
        aic_quantity: '12.3146',
        aic_gross_amount: '0.123146',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(aicRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.queryByText('Usage-based billing preview')).not.toBeInTheDocument();
      expect(screen.queryByText(/Learn more about usage-based billing/)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'gh.io/copilot-billing-blog' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'gh.io/billing-preview' })).not.toBeInTheDocument();
      expect(screen.getAllByText('AI Credits').length).toBeGreaterThan(0);
      expect(screen.getByLabelText('billing-summary')).toHaveTextContent('Gross cost');
      expect(screen.getByLabelText('billing-summary')).toHaveTextContent('Additional usage');
      expect(screen.queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'AI Usage' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'AI Usage' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'AI Usage' })).toBeInTheDocument();
      expect(screen.getByText('AI Credits Group Heatmap')).toBeInTheDocument();
      expect(screen.getByRole('table', { name: 'AI Credits user group heatmap' })).toBeInTheDocument();
      expect(screen.getByText('Users by group')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cost Centers' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /test-cost-center-two/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Cloud Agent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cloud Agent').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Organizations' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /test-org-three/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Copilot').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Copilot').length).toBeGreaterThan(0);
    });
  });

  it('renders the top three AI Credits models on the Models page with mixed AIC fields', async () => {
    const aicRows: CSVData[] = [
      {
        date: '2026-03-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Model Alpha',
        quantity: '10',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
        aic_quantity: '50',
        aic_gross_amount: '0.5',
      },
      {
        date: '2026-03-02',
        username: 'test-user-two',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Model Beta',
        quantity: '20',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
        aic_quantity: '100',
        aic_gross_amount: '1',
      },
      {
        date: '2026-03-03',
        username: 'test-user-three',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Model Gamma',
        quantity: '5',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        organization: 'test-org-two',
        cost_center_name: 'test-cost-center-two',
        aic_quantity: '30',
        aic_gross_amount: '0.3',
      },
      {
        date: '2026-03-04',
        username: 'test-user-four',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Model Delta',
        quantity: '8',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        organization: 'test-org-two',
        cost_center_name: 'test-cost-center-two',
        aic_quantity: '80',
        aic_gross_amount: '0.8',
      },
      {
        date: '2026-03-05',
        username: 'test-user-five',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Model Epsilon',
        quantity: '12',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        organization: 'test-org-three',
        cost_center_name: 'test-cost-center-three',
        aic_gross_amount: '1.2',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(aicRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Models' })[0]);

    const topModelsTable = await screen.findByRole('table', { name: 'Top AI Credits models' });
    const rows = within(topModelsTable).getAllByRole('row');

    expect(screen.getByText(/Top 3 models drive/)).toHaveTextContent('Top 3 models drive 76.4% of total AI Credits consumption.');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('#1');
    expect(rows[1]).toHaveTextContent('Model Beta');
    expect(rows[1]).toHaveTextContent('20.00');
    expect(rows[1]).toHaveTextContent('36.4%');
    expect(rows[2]).toHaveTextContent('Model Epsilon');
    expect(rows[2]).toHaveTextContent('12.00');
    expect(rows[2]).toHaveTextContent('21.8%');
    expect(rows[3]).toHaveTextContent('Model Alpha');
    expect(rows[3]).toHaveTextContent('18.2%');
    expect(within(topModelsTable).queryByText('Model Delta')).not.toBeInTheDocument();
    expect(within(topModelsTable).queryByText('Model Gamma')).not.toBeInTheDocument();
  });

  it('renders AI Credits columns for zero-value new-format AIC fields', async () => {
    const zeroAicRows: CSVData[] = [{
      date: '2026-03-01',
      username: 'test-user-one',
      product: 'copilot',
      sku: 'copilot_ai_credit',
      model: 'Claude Opus 4.6',
      quantity: '2',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
      applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
      gross_amount: '0.08',
      discount_amount: '0.08',
      net_amount: '0',
      organization: 'test-org-one',
      cost_center_name: 'test-cost-center-one',
      aic_quantity: '0',
      aic_gross_amount: '0',
    }];

    const ingestionResult = createIngestionResultFromRawRows(zeroAicRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.queryByText('Usage-based billing preview')).not.toBeInTheDocument();
      expect(screen.getByLabelText('billing-summary')).toHaveTextContent('Additional usage');
      expect(screen.queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cost Centers' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Organizations' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits' }).length).toBeGreaterThan(0);
    });
  });

  it('shows AI-credit quantity when optional primary billing fields are absent', async () => {
    const aicOnlyRows: CSVData[] = [{
      date: '2026-03-01',
      username: 'test-user-one',
      product: 'copilot',
      sku: 'copilot_ai_credit',
      model: 'Claude Opus 4.6',
      quantity: '2',
      total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
      organization: 'test-org-one',
      cost_center_name: 'test-cost-center-one',
      aic_quantity: '12.5',
      aic_gross_amount: '0.125',
    }];

    const ingestionResult = createIngestionResultFromRawRows(aicOnlyRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Cost per Product')).toBeInTheDocument();
    });

    const productHeader = screen.getByRole('columnheader', { name: 'Product' });
    const productTable = productHeader.closest('table');
    expect(productTable).not.toBeNull();
    const table = within(productTable!);

    expect(table.getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
    expect(table.queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
    expect(table.queryByRole('columnheader', { name: 'Gross' })).not.toBeInTheDocument();
    expect(table.queryByRole('columnheader', { name: 'Discount' })).not.toBeInTheDocument();
    expect(table.queryByRole('columnheader', { name: 'Net' })).not.toBeInTheDocument();
    expect(table.getByText('2.00')).toBeInTheDocument();
  });

  it('renames discount and net billing labels for usage-based AI Credits reports', async () => {
    const usageBasedRows: CSVData[] = [
      {
        date: '2026-06-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Auto: Claude Haiku 4.5',
        quantity: '42.5',
        unit_type: 'ai-credits',
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.425',
        discount_amount: '0.425',
        net_amount: '0',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2026-06-01',
        username: 'test-user-two',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Auto: Claude Haiku 4.5',
        quantity: '3',
        unit_type: 'requests',
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.12',
        discount_amount: '0',
        net_amount: '0.12',
        total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(usageBasedRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="usage-based.csv" onReset={() => {}} />);

    await waitFor(() => {
      const billing = screen.getByLabelText('billing-summary');
      expect(billing).toHaveTextContent('Included credits');
      expect(billing).toHaveTextContent('Additional usage');
      expect(billing).not.toHaveTextContent('Discounts');
      expect(billing).not.toHaveTextContent('Net cost');
      expect(screen.getByText('Current Billing')).toBeInTheDocument();
      expect(screen.getByText('Licenses')).toBeInTheDocument();
      expect(screen.queryByLabelText('ai-credits-summary')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'AI Credits by Model' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Requests by Model' })).not.toBeInTheDocument();
      expect(screen.getByText('Total: 42.50 AI Credits')).toBeInTheDocument();
      expect(screen.getByText('Auto Mode Savings')).toBeInTheDocument();
      expect(screen.getByText(/10% AI Credits discount/)).toBeInTheDocument();
      expect(screen.getAllByText('42.50').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.47').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.05').length).toBeGreaterThan(0);
      expect(screen.getByText('$0.05 saved')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'Included Credits' }).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByRole('columnheader', { name: 'Additional usage' }).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByRole('button', { name: 'Insights' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Cost Optimization' }).length).toBeGreaterThan(0);
    });

    const productHeader = screen.getByRole('columnheader', { name: 'Product' });
    const productTable = productHeader.closest('table');
    expect(productTable).not.toBeNull();
    expect(within(productTable!).getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
    expect(within(productTable!).queryByRole('columnheader', { name: 'Requests' })).not.toBeInTheDocument();
    expect(within(productTable!).queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();

    const autoModeSavingsHeading = screen.getByRole('heading', { name: 'Auto Mode Savings' });
    const autoModeSavingsCard = autoModeSavingsHeading.closest('.bg-white');
    expect(autoModeSavingsCard).not.toBeNull();
    const autoModeSavingsTable = within(autoModeSavingsCard as HTMLElement).getByRole('table');
    expect(within(autoModeSavingsTable).getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
    expect(within(autoModeSavingsTable).queryByRole('columnheader', { name: 'Requests' })).not.toBeInTheDocument();
    expect(within(autoModeSavingsTable).getAllByText('42.50').length).toBeGreaterThan(0);
    expect(within(autoModeSavingsTable).queryByText('45.50')).not.toBeInTheDocument();

    const modelDetailsHeading = screen.getByRole('heading', { name: 'Model Details' });
    const modelDetailsCard = modelDetailsHeading.closest('.bg-white');
    expect(modelDetailsCard).not.toBeNull();
    const modelDetailsTable = within(modelDetailsCard as HTMLElement).getByRole('table');
    expect(within(modelDetailsTable).getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
    expect(within(modelDetailsTable).getByRole('columnheader', { name: 'Gross Amount' })).toBeInTheDocument();
    expect(within(modelDetailsTable).getByRole('columnheader', { name: 'Included Credits' })).toBeInTheDocument();
    expect(within(modelDetailsTable).getByRole('columnheader', { name: 'Additional usage' })).toBeInTheDocument();
    expect(within(modelDetailsTable).queryByRole('columnheader', { name: 'Requests' })).not.toBeInTheDocument();
    expect(within(modelDetailsTable).queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
    expect(within(modelDetailsTable).queryByRole('columnheader', { name: 'Gross' })).not.toBeInTheDocument();
    expect(within(modelDetailsTable).getByText('42.50')).toBeInTheDocument();
    expect(within(modelDetailsTable).queryByText('45.50')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Models' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Model Usage Trends' })).toBeInTheDocument();
      expect(screen.getByText('Daily stacked AI Credits by model (UTC)')).toBeInTheDocument();
      expect(screen.queryByText('No model usage data available for the selected period.')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cost Centers' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Gross Amount' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Included Credits' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Additional usage' })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Gross' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Organizations' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Gross Amount' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Included Credits' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Additional usage' })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Gross' })).not.toBeInTheDocument();
    });
  });

  it.each([
    { buttonName: 'Insights', headingName: 'Consumption Insights' },
    { buttonName: 'Cost Optimization', headingName: 'Cost Optimization' },
  ])('keeps $buttonName available when switching AI-credit reports', async ({ buttonName, headingName }) => {
    const usageBasedRows: CSVData[] = [
      {
        date: '2026-06-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Auto: Claude Haiku 4.5',
        quantity: '42.5',
        unit_type: 'ai-credits',
        applied_cost_per_quantity: '0.01',
        gross_amount: '0.425',
        discount_amount: '0.425',
        net_amount: '0',
        total_monthly_quota: '3900',
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
      },
    ];
    const firstReport = createIngestionResultFromRawRows(newFormatRows);
    const usageBasedReport = createIngestionResultFromRawRows(usageBasedRows);
    const { rerender } = render(
      <DataAnalysis ingestionResult={firstReport} filename="first-report.csv" onReset={() => {}} />
    );

    fireEvent.click(screen.getAllByRole('button', { name: buttonName })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: buttonName }).length).toBeGreaterThan(0);
    });

    rerender(<DataAnalysis ingestionResult={usageBasedReport} filename="usage-based.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('usage-based.csv')).toBeInTheDocument();
      if (buttonName === 'Insights') {
        expect(screen.getByRole('heading', { name: headingName })).toBeInTheDocument();
      }
      expect(screen.getAllByRole('button', { name: 'Insights' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Cost Optimization' }).length).toBeGreaterThan(0);
    });
  });

  it('renders cost per product and per-model billing details on the overview page', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2025-10-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Claude Sonnet 4',
        quantity: '3.6',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.144',
        discount_amount: '0.010',
        net_amount: '0.134',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2025-10-02',
        username: 'test-user-two',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Coding Agent',
        quantity: '2',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.080',
        discount_amount: '0.020',
        net_amount: '0.060',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2025-10-03',
        username: 'test-user-three',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Code Review',
        quantity: '1',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.040',
        discount_amount: '0.005',
        net_amount: '0.035',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2025-10-04',
        username: 'test-user-four',
        product: 'spark',
        sku: 'copilot_ai_credit',
        model: 'Claude Sonnet 4.5',
        quantity: '4',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.160',
        discount_amount: '0.000',
        net_amount: '0.160',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2025-10-05',
        username: 'test-user-five',
        product: 'code_quality',
        sku: 'code_quality_ai_credit',
        model: 'Claude Sonnet 4.6',
        quantity: '51.28584',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: '0.01',
        gross_amount: '0.5128584',
        discount_amount: '0.000',
        net_amount: '0.5128584',
        cost_center_name: 'test-cost-center-one',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Cost per Product')).toBeInTheDocument();
      expect(screen.getByText('Copilot')).toBeInTheDocument();
      expect(screen.getAllByText('Spark').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cloud Agent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Code Review').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Code Quality').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: 'Insights' }).length).toBeGreaterThan(0);

      expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument();
      expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
      expect(screen.getAllByText('$0.14').length).toBeGreaterThan(0);
      expect(screen.getAllByText('-$0.01').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.13').length).toBeGreaterThan(0);
    });
  });

  it('renders Auto Mode savings by base model with total savings', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2026-04-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Auto: GPT-5.3-Codex',
        quantity: '0.9',
        total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.036',
        discount_amount: '0',
        net_amount: '0.036',
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Auto Mode Savings')).toBeInTheDocument();
      expect(screen.getByText('GPT-5.3-Codex')).toBeInTheDocument();
      expect(screen.getAllByText('0.90').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.04').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
      expect(screen.getByText('$0.00 saved')).toBeInTheDocument();
    });
  });

  it('shows Spark as a separate product inside cost center breakdowns', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2025-10-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Claude Sonnet 4',
        quantity: '1',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.040',
        discount_amount: '0.000',
        net_amount: '0.040',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2025-10-02',
        username: 'test-user-two',
        product: 'spark',
        sku: 'copilot_ai_credit',
        model: 'Claude Sonnet 4.5',
        quantity: '4',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.160',
        discount_amount: '0.000',
        net_amount: '0.160',
        cost_center_name: 'test-cost-center-one',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Cost Centers' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test-cost-center-one/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /test-cost-center-one/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Spark').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Copilot').length).toBeGreaterThan(0);
    });
  });

  it('shows Code Quality as a separate product inside cost center breakdowns', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2025-10-01',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Claude Sonnet 4',
        quantity: '1',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.040',
        discount_amount: '0.000',
        net_amount: '0.040',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2025-10-02',
        username: 'test-user-two',
        product: 'code_quality',
        sku: 'code_quality_ai_credit',
        model: 'Claude Sonnet 4.6',
        quantity: '51.28584',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: '0.01',
        gross_amount: '0.5128584',
        discount_amount: '0.000',
        net_amount: '0.5128584',
        cost_center_name: 'test-cost-center-one',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Cost Centers' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test-cost-center-one/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /test-cost-center-one/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Code Quality').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Copilot').length).toBeGreaterThan(0);
    });
  });

  it('keeps unattributed Code Review credits in grouped billing without inventing a user', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2025-10-01',
        username: '',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Code Review',
        quantity: '3',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.120',
        discount_amount: '0.000',
        net_amount: '0.120',
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
      },
      {
        date: '2025-10-02',
        username: 'test-user-one',
        product: 'copilot',
        sku: 'copilot_ai_credit',
        model: 'Code Review',
        quantity: '2',
        total_monthly_quota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
        gross_amount: '0.080',
        discount_amount: '0.000',
        net_amount: '0.080',
        organization: 'test-org-one',
        cost_center_name: 'test-cost-center-one',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    const usage = ingestionResult.outputs.usage as UsageArtifacts;
    const billing = ingestionResult.outputs.billing as BillingArtifacts;
    expect(usage.userCount).toBe(1);
    expect(usage.specialBuckets).toEqual([
      expect.objectContaining({ label: 'Unattributed AI Credits', totalCredits: 3 }),
    ]);
    expect(usage.modelTotals['Code Review']).toBe(5);
    expect(billing.billingByModel.get('Code Review')?.quantity).toBe(5);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('Code Review').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test-cost-center-one/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /test-cost-center-one/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Code Review').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Organizations' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test-org-one/i })).toBeInTheDocument();
    });

    const organizationRow = screen.getByRole('button', { name: /test-org-one/i }).closest('tr');
    expect(organizationRow).not.toBeNull();
    expect(within(organizationRow as HTMLTableRowElement).getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /test-org-one/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Code Review').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Insights' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Feature Utilization')).toBeInTheDocument();
      expect(screen.getAllByText('Code Review').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Agent Adoption' })[0]);
    expect(screen.getAllByText('Unattributed AI Credits').length).toBeGreaterThan(0);
  });
});
