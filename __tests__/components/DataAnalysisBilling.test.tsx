import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DataAnalysis } from '@/components/DataAnalysis';
import { newFormatRows } from '../fixtures/newFormatCSVData';
import type { CSVData } from '@/types/csv';
import { normalizeRow } from '@/utils/ingestion/normalizeRow';
import type { IngestionResult } from '@/utils/ingestion';
import type { NormalizedRow } from '@/utils/ingestion/types';

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

  return {
    outputs: {
      'quota': { quotaByUser: new Map(), conflicts: new Map(), distinctQuotas: new Set(), hasMixedQuotas: false, hasMixedLicenses: false },
      'usage': { users: [], userTotals: new Map(), modelBreakdown: new Map(), globalModelTotals: new Map(), topModelPerUser: new Map(), modelTotals: {}, userCount: 0, modelCount: 0 },
      'dailyBuckets': { dailyUserTotals: new Map(), startDate: new Date(), endDate: new Date() },
      'rawData': normalizedRows
    },
    rowsProcessed: normalizedRows.length,
    durationMs: 100,
    warnings
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
      expect(billing).toHaveTextContent(/Net/i);
    });

    expect(screen.queryByText('Usage-based billing preview')).not.toBeInTheDocument();
  });

  it('renders AI Credits callout and overview card when AIC fields are present', async () => {
    const aicRows: CSVData[] = [
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
      {
        date: '2026-03-01',
        username: 'test-user-b',
        product: 'copilot',
        sku: 'coding_agent_premium_request',
        model: 'Coding Agent model',
        quantity: '2',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.08',
        discount_amount: '0.08',
        net_amount: '0',
        organization: 'example-org-b',
        cost_center_name: 'example-cost-center-b',
        aic_quantity: '18.33306',
        aic_gross_amount: '0.1833306',
      },
      {
        date: '2026-03-02',
        username: 'test-user-c',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Claude Opus 4.6',
        quantity: '24',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.96',
        discount_amount: '0.96',
        net_amount: '0',
        organization: 'example-org-c',
        cost_center_name: '',
        aic_quantity: '12.3146',
        aic_gross_amount: '0.123146',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(aicRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Usage-based billing preview')).toBeInTheDocument();
      expect(screen.getByText(/Learn more about usage-based billing/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'gh.io/copilot-billing-blog' })).toHaveAttribute('href', 'https://gh.io/copilot-billing-blog');
      expect(screen.getByRole('link', { name: 'gh.io/billing-preview' })).toHaveAttribute('href', 'https://gh.io/billing-preview');
      expect(screen.getAllByText('AI Credits').length).toBeGreaterThan(0);
      expect(screen.getByLabelText('ai-credits-summary')).toHaveTextContent('$0.39');
      expect(screen.getByLabelText('ai-credits-summary')).toHaveTextContent('AI Credits included');
      expect(screen.getByLabelText('ai-credits-summary')).toHaveTextContent('21,000');
      expect(screen.getByLabelText('ai-credits-summary')).toHaveTextContent('AI Credits additional usage gross');
      expect(screen.getByLabelText('ai-credits-summary')).toHaveTextContent('$0.00');
      expect(screen.getByText('39.34')).toBeInTheDocument();
      expect(screen.getByText('1 credit = $0.01')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' })).toHaveLength(2);
      expect(screen.getAllByText('$0.27').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.12').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cost Centers' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' }).length).toBeGreaterThan(0);
      expect(screen.getByText('$0.18')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /example-cost-center-b/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Cloud Agent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.18').length).toBeGreaterThan(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Organizations' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' }).length).toBeGreaterThan(0);
      expect(screen.getByText('$0.12')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /example-org-c/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Copilot').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.12').length).toBeGreaterThan(1);
    });
  });

  it('renders AI Credits columns for zero-value new-format AIC fields', async () => {
    const zeroAicRows: CSVData[] = [{
      date: '2026-03-01',
      username: 'zero-user',
      product: 'copilot',
      sku: 'copilot_premium_request',
      model: 'Claude Opus 4.6',
      quantity: '2',
      total_monthly_quota: '1000',
      applied_cost_per_quantity: '0.04',
      gross_amount: '0.08',
      discount_amount: '0.08',
      net_amount: '0',
      organization: 'zero-org',
      cost_center_name: 'zero-cost-center',
      aic_quantity: '0',
      aic_gross_amount: '0',
    }];

    const ingestionResult = createIngestionResultFromRawRows(zeroAicRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Usage-based billing preview')).toBeInTheDocument();
      expect(screen.getByLabelText('ai-credits-summary')).toHaveTextContent('$0.00');
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cost Centers' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Organizations' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' }).length).toBeGreaterThan(0);
    });
  });

  it('renders cost per product and per-model billing details on the overview page', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2025-10-01',
        username: 'alice',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Claude Sonnet 4',
        quantity: '3.6',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.144',
        discount_amount: '0.010',
        net_amount: '0.134',
        cost_center_name: 'Engineering',
      },
      {
        date: '2025-10-02',
        username: 'bob',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Coding Agent',
        quantity: '2',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.080',
        discount_amount: '0.020',
        net_amount: '0.060',
        cost_center_name: 'Engineering',
      },
      {
        date: '2025-10-03',
        username: 'carol',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Code Review',
        quantity: '1',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.040',
        discount_amount: '0.005',
        net_amount: '0.035',
        cost_center_name: 'Engineering',
      },
      {
        date: '2025-10-04',
        username: 'dave',
        product: 'spark',
        sku: 'spark_premium_request',
        model: 'Claude Sonnet 4.5',
        quantity: '4',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.160',
        discount_amount: '0.000',
        net_amount: '0.160',
        cost_center_name: 'Engineering',
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
        username: 'auto-mode-user',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Auto: GPT-5.3-Codex',
        quantity: '0.9',
        exceeds_quota: 'False',
        total_monthly_quota: '300',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.036',
        discount_amount: '0',
        net_amount: '0.036',
        organization: 'example-org',
        cost_center_name: 'example-cost-center',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Auto Mode Savings')).toBeInTheDocument();
      expect(screen.getByText('GPT-5.3-Codex')).toBeInTheDocument();
      expect(screen.getAllByText('1.00').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.04').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
      expect(screen.getByText('$0.00 saved')).toBeInTheDocument();
    });
  });

  it('shows Spark as a separate product inside cost center breakdowns', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2025-10-01',
        username: 'alice',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Claude Sonnet 4',
        quantity: '1',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.040',
        discount_amount: '0.000',
        net_amount: '0.040',
        cost_center_name: 'Engineering',
      },
      {
        date: '2025-10-02',
        username: 'bob',
        product: 'spark',
        sku: 'spark_premium_request',
        model: 'Claude Sonnet 4.5',
        quantity: '4',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.160',
        discount_amount: '0.000',
        net_amount: '0.160',
        cost_center_name: 'Engineering',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Cost Centers' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Engineering/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Engineering/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Spark').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Copilot').length).toBeGreaterThan(0);
    });
  });

  it('shows non-Copilot code review as a separate aggregate product and insight block', async () => {
    const billingRows: CSVData[] = [
      {
        date: '2025-10-01',
        username: '',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Code Review',
        quantity: '3',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.120',
        discount_amount: '0.000',
        net_amount: '0.120',
        organization: 'Org One',
        cost_center_name: 'Engineering',
      },
      {
        date: '2025-10-02',
        username: 'alice',
        product: 'copilot',
        sku: 'copilot_premium_request',
        model: 'Code Review',
        quantity: '2',
        exceeds_quota: 'False',
        total_monthly_quota: '1000',
        applied_cost_per_quantity: '0.04',
        gross_amount: '0.080',
        discount_amount: '0.000',
        net_amount: '0.080',
        organization: 'Org One',
        cost_center_name: 'Engineering',
      },
    ];

    const ingestionResult = createIngestionResultFromRawRows(billingRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('Code Review for Non-Copilot Users').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cost Centers' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Engineering/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Engineering/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Code Review for Non-Copilot Users').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Organizations' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Org One/i })).toBeInTheDocument();
    });

    const organizationRow = screen.getByRole('button', { name: /Org One/i }).closest('tr');
    expect(organizationRow).not.toBeNull();
    expect(within(organizationRow as HTMLTableRowElement).getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Org One/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Code Review for Non-Copilot Users').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Insights' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Feature Utilization')).toBeInTheDocument();
      expect(screen.getAllByText('Code Review for Non-Copilot Users').length).toBeGreaterThan(0);
      expect(screen.getByText('Aggregate requests outside licensed Copilot users')).toBeInTheDocument();
    });
  });
});
