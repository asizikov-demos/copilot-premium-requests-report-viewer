import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { UserDetailsView } from '@/components/UserDetailsView';
import type { ProcessedData } from '@/types/csv';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

describe('UserDetailsView', () => {
  const mockOnBack = jest.fn();

  const createMockProcessedData = (quotaValues: Array<number | 'unlimited'>): ProcessedData[] => {
    return quotaValues.map((quotaValue, index) => {
      const timestamp = new Date(`2025-06-${10 + index}T10:00:00Z`);
      const iso = timestamp.toISOString();
      return {
        timestamp,
        user: 'User1',
        model: 'gpt-4',
        requestsUsed: 1,
        exceedsQuota: false,
        totalQuota: quotaValue === 'unlimited' ? 'Unlimited' : quotaValue.toString(),
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

  it('renders unlimited quota details', async () => {
    render(
      <UserDetailsView
        user="User1"
        processedData={createMockProcessedData(['unlimited'])}
        userQuotaValue="unlimited"
        onBack={mockOnBack}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Unlimited/)).toBeInTheDocument();
      expect(screen.getByText(/\d+(\.\d+)?\s*\/\s*∞/)).toBeInTheDocument();
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
});
