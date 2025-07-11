import { render, screen, waitFor } from '@testing-library/react';
import { UserConsumptionModal } from '@/components/UserConsumptionModal';
import { ProcessedData } from '@/types/csv';

// Mock recharts components
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

// Mock portal to render directly
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('UserConsumptionModal', () => {
  const mockOnClose = jest.fn();
  
  const createMockProcessedData = (quotaValues: (number | 'unlimited')[]): ProcessedData[] => {
    return quotaValues.map((quotaValue, index) => ({
      timestamp: new Date(`2025-06-${10 + index}T10:00:00Z`),
      user: `User${index + 1}`,
      model: 'gpt-4',
      requestsUsed: 1,
      exceedsQuota: false,
      totalQuota: quotaValue === 'unlimited' ? 'Unlimited' : quotaValue.toString(),
      quotaValue
    }));
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    
    // Mock document.body
    Object.defineProperty(document, 'body', {
      value: document.createElement('body'),
      writable: true,
    });
  });

  it('should display Business plan for business quota user', async () => {
    const processedData = createMockProcessedData([300, 300]); // All business users
    
    render(
      <UserConsumptionModal
        user="User1"
        processedData={processedData}
        selectedPlan="business"
        currentQuota={300}
        userQuotaValue={300}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Copilot Business - Daily Usage Overview/)).toBeInTheDocument();
    });
  });

  it('should display Enterprise plan for enterprise quota user', () => {
    const processedData = createMockProcessedData([1000, 1000]); // All enterprise users
    
    render(
      <UserConsumptionModal
        user="User1"
        processedData={processedData}
        selectedPlan="enterprise"
        currentQuota={1000}
        userQuotaValue={1000}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Copilot Enterprise - Daily Usage Overview/)).toBeInTheDocument();
  });

  it('should display Mixed Licenses when billing period has both business and enterprise users', () => {
    const processedData = createMockProcessedData([300, 1000]); // Mixed: business and enterprise
    
    render(
      <UserConsumptionModal
        user="User1"
        processedData={processedData}
        selectedPlan="business"
        currentQuota={300}
        userQuotaValue={300}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Mixed Licenses - Daily Usage Overview/)).toBeInTheDocument();
  });

  it('should display Unlimited Plan for unlimited quota user', () => {
    const processedData = createMockProcessedData(['unlimited']); // Unlimited user
    
    render(
      <UserConsumptionModal
        user="User1"
        processedData={processedData}
        selectedPlan="business"
        currentQuota={300}
        userQuotaValue="unlimited"
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Unlimited Plan - Daily Usage Overview/)).toBeInTheDocument();
  });

  it('should not show Mixed Licenses for unlimited and business mix', () => {
    const processedData = createMockProcessedData(['unlimited', 300]); // Unlimited and business
    
    render(
      <UserConsumptionModal
        user="User1"
        processedData={processedData}
        selectedPlan="business"
        currentQuota={300}
        userQuotaValue={300}
        onClose={mockOnClose}
      />
    );

    // Should show business plan, not mixed licenses (mixed licenses only for business+enterprise)
    expect(screen.getByText(/Copilot Business - Daily Usage Overview/)).toBeInTheDocument();
    expect(screen.queryByText(/Mixed Licenses/)).not.toBeInTheDocument();
  });

  it('should not show Mixed Licenses for unlimited and enterprise mix', () => {
    const processedData = createMockProcessedData(['unlimited', 1000]); // Unlimited and enterprise
    
    render(
      <UserConsumptionModal
        user="User1"
        processedData={processedData}
        selectedPlan="enterprise"
        currentQuota={1000}
        userQuotaValue={1000}
        onClose={mockOnClose}
      />
    );

    // Should show enterprise plan, not mixed licenses (mixed licenses only for business+enterprise)
    expect(screen.getByText(/Copilot Enterprise - Daily Usage Overview/)).toBeInTheDocument();
    expect(screen.queryByText(/Mixed Licenses/)).not.toBeInTheDocument();
  });
});
