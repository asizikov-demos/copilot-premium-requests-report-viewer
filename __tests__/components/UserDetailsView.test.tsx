import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { UserDetailsView } from '@/components/UserDetailsView';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ComposedChart: ({ children, data }: { children: React.ReactNode; data?: unknown }) => (
    <div data-testid="composed-chart" data-chart={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: ({ y, label }: { y?: number | string; label?: { value?: string } }) => (
    <div data-testid="reference-line" data-y={String(y ?? '')}>
      {label?.value}
    </div>
  ),
}));

describe('UserDetailsView', () => {
  const mockOnBack = jest.fn();

  const createMockProcessedData = (quotaValues: Array<number | 'unknown'>): ProcessedData[] => {
    return quotaValues.map((quotaValue, index) => {
      const timestamp = new Date(`2025-06-${10 + index}T10:00:00Z`);
      const iso = timestamp.toISOString();
      return {
        timestamp,
        user: 'User1',
        model: 'gpt-4',
        requestsUsed: 1,
        exceedsQuota: false,
        totalQuota: quotaValue === 'unknown' ? 'Unknown' : quotaValue.toString(),
        quotaValue,
        iso,
        dateKey: iso.slice(0, 10),
        monthKey: iso.slice(0, 7),
        epoch: timestamp.getTime(),
        organization: 'Org1',
        costCenter: 'CC-123',
      } as ProcessedData;
    });
  };

  beforeEach(() => {
    mockOnBack.mockClear();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    });
  });

  it('renders github-style breadcrumbs and navigates back', async () => {
    render(
      <UserDetailsView
        user="User1"
        processedData={createMockProcessedData([300])}
        userQuotaValue={300}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'users' }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getAllByText('User1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Copilot Business/)).toBeInTheDocument();
      expect(screen.getByText(/\d+(\.\d+)?\s*\/\s*300/)).toBeInTheDocument();
    });
  });

  it('renders unknown quota details', async () => {
    render(
      <UserDetailsView
        user="User1"
        processedData={createMockProcessedData(['unknown'])}
        userQuotaValue="unknown"
        onBack={mockOnBack}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Unknown/)).toBeInTheDocument();
      expect(screen.getByText(/\d+(\.\d+)?\s*\/\s*Unknown/)).toBeInTheDocument();
    });
  });

  it('renders Spark as a separate billing product bucket', async () => {
    const timestamp = new Date('2025-06-10T10:00:00Z');
    const iso = timestamp.toISOString();
    const processedData: ProcessedData[] = [
      {
        timestamp,
        user: 'User1',
        model: 'Claude Sonnet 4.5',
        requestsUsed: 4,
        exceedsQuota: false,
        totalQuota: '1000',
        quotaValue: 1000,
        iso,
        dateKey: iso.slice(0, 10),
        monthKey: iso.slice(0, 7),
        epoch: timestamp.getTime(),
        product: 'spark',
        sku: 'spark_premium_request',
        organization: 'Org1',
        costCenter: 'CC-123',
        grossAmount: 0.16,
        discountAmount: 0,
        netAmount: 0.16,
      },
    ];

    render(
      <UserDetailsView
        user="User1"
        processedData={processedData}
        userQuotaValue={1000}
        onBack={mockOnBack}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cost per Product')).toBeInTheDocument();
      expect(screen.getByText('Spark')).toBeInTheDocument();
      expect(screen.queryByText('Copilot')).not.toBeInTheDocument();
    });
  });

  it('renders AI Credits Gross in product and daily model breakdown tables', async () => {
    const firstTimestamp = new Date('2026-03-01T00:00:00Z');
    const secondTimestamp = new Date('2026-03-02T00:00:00Z');
    const firstIso = firstTimestamp.toISOString();
    const secondIso = secondTimestamp.toISOString();
    const processedData: ProcessedData[] = [
      {
        timestamp: firstTimestamp,
        user: 'User1',
        model: 'Coding Agent model',
        requestsUsed: 2,
        exceedsQuota: false,
        totalQuota: '1000',
        quotaValue: 1000,
        iso: firstIso,
        dateKey: firstIso.slice(0, 10),
        monthKey: firstIso.slice(0, 7),
        epoch: firstTimestamp.getTime(),
        product: 'copilot',
        sku: 'coding_agent_premium_request',
        grossAmount: 0.08,
        discountAmount: 0.08,
        netAmount: 0,
        aicGrossAmount: 1.23,
      },
      {
        timestamp: secondTimestamp,
        user: 'User1',
        model: 'Claude Opus 4.6',
        requestsUsed: 24,
        exceedsQuota: false,
        totalQuota: '1000',
        quotaValue: 1000,
        iso: secondIso,
        dateKey: secondIso.slice(0, 10),
        monthKey: secondIso.slice(0, 7),
        epoch: secondTimestamp.getTime(),
        product: 'copilot',
        sku: 'copilot_premium_request',
        grossAmount: 0.96,
        discountAmount: 0.96,
        netAmount: 0,
        aicGrossAmount: 4.56,
      },
    ];

    render(
      <UserDetailsView
        user="User1"
        processedData={processedData}
        userQuotaValue={1000}
        onBack={mockOnBack}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cost per Product')).toBeInTheDocument();
      expect(screen.getByText('Daily Model Usage Breakdown')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' })).toHaveLength(2);
      expect(document.body).toHaveTextContent('$1.23');
      expect(document.body).toHaveTextContent('$4.56');
    });

    const codingAgentDailyRow = screen.getByText('- Coding Agent model').closest('tr');
    expect(codingAgentDailyRow).not.toBeNull();
    const codingAgentDailyCells = within(codingAgentDailyRow as HTMLElement).getAllByRole('cell');
    expect(codingAgentDailyCells[3]).toHaveTextContent('$1.23');
    expect(codingAgentDailyCells[4]).toHaveTextContent('$0.08');

    const opusDailyRow = screen.getByText('- Claude Opus 4.6').closest('tr');
    expect(opusDailyRow).not.toBeNull();
    const opusDailyCells = within(opusDailyRow as HTMLElement).getAllByRole('cell');
    expect(opusDailyCells[3]).toHaveTextContent('$4.56');
    expect(opusDailyCells[4]).toHaveTextContent('$0.96');
  });

  it('renders AI Credits Gross columns when new report fields are present with zero spend', async () => {
    const timestamp = new Date('2026-03-01T00:00:00Z');
    const iso = timestamp.toISOString();
    const processedData: ProcessedData[] = [{
      timestamp,
      user: 'User1',
      model: 'Claude Opus 4.6',
      requestsUsed: 24,
      exceedsQuota: false,
      totalQuota: '1000',
      quotaValue: 1000,
      iso,
      dateKey: iso.slice(0, 10),
      monthKey: iso.slice(0, 7),
      epoch: timestamp.getTime(),
      product: 'copilot',
      sku: 'copilot_premium_request',
      grossAmount: 0.96,
      discountAmount: 0.96,
      netAmount: 0,
      aicGrossAmount: 0,
    }];

    render(
      <UserDetailsView
        user="User1"
        processedData={processedData}
        userQuotaValue={1000}
        onBack={mockOnBack}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' })).toHaveLength(2);
    });

    const opusDailyRow = screen.getByText('- Claude Opus 4.6').closest('tr');
    expect(opusDailyRow).not.toBeNull();
    const opusDailyCells = within(opusDailyRow as HTMLElement).getAllByRole('cell');
    expect(opusDailyCells[3]).toHaveTextContent('$0.00');
    expect(opusDailyCells[4]).toHaveTextContent('$0.96');
  });

  it('uses usage-based billing columns in product and daily model breakdown tables', async () => {
    const timestamp = new Date('2026-06-01T00:00:00Z');
    const iso = timestamp.toISOString();
    const processedData: ProcessedData[] = [{
      timestamp,
      user: 'test-user-one',
      model: 'Auto: Claude Haiku 4.5',
      requestsUsed: 0,
      exceedsQuota: false,
      totalQuota: PRICING.BUSINESS_AI_CREDIT_QUOTA.toString(),
      quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      iso,
      dateKey: iso.slice(0, 10),
      monthKey: iso.slice(0, 7),
      epoch: timestamp.getTime(),
      product: 'copilot',
      sku: 'copilot_ai_credit',
      unitType: 'ai-credits',
      usageUnit: 'ai_credit',
      billingQuantity: 42.5,
      aicQuantity: 42.5,
      grossAmount: 0.425,
      discountAmount: 0.425,
      netAmount: 0,
      aicGrossAmount: 0.425,
    }];

    render(
      <UserDetailsView
        user="test-user-one"
        processedData={processedData}
        userQuotaValue={PRICING.BUSINESS_AI_CREDIT_QUOTA}
        onBack={mockOnBack}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cost per Product')).toBeInTheDocument();
      expect(screen.getByText('Bars: daily AI Credits by model · Black line: cumulative · Red line: quota')).toBeInTheDocument();
      expect(screen.getByText('Daily Model Usage Breakdown')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader', { name: 'AI Credits' })).toHaveLength(2);
      expect(screen.getAllByRole('columnheader', { name: 'Gross Amount' })).toHaveLength(2);
      expect(screen.queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Requests' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Gross' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Gross Cost' })).not.toBeInTheDocument();
    });

    const dailyRow = screen.getByText('- Auto: Claude Haiku 4.5').closest('tr');
    expect(dailyRow).not.toBeNull();
    const dailyCells = within(dailyRow as HTMLElement).getAllByRole('cell');
    expect(dailyCells[2]).toHaveTextContent('42.50');
    expect(dailyCells[3]).toHaveTextContent('$0.43');

    const chartData = screen.getByTestId('composed-chart').getAttribute('data-chart') ?? '';
    expect(chartData).toContain('"Auto: Claude Haiku 4.5":42.5');
    expect(chartData).toContain('"totalCumulative":42.5');
    expect(screen.getByTestId('reference-line')).toHaveAttribute(
      'data-y',
      PRICING.BUSINESS_AI_CREDIT_QUOTA.toString()
    );
  });
});
