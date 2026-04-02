import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
});
