import '@testing-library/jest-dom';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { UsersOverview } from '@/components/UsersOverview';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics/powerUsers';
import type { QuotaArtifacts, UsageArtifacts } from '@/utils/ingestion';

// Mock recharts components used by UsersQuotaConsumptionChart.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function makeQuota(entries: Array<{ user: string; quota: number | 'unlimited' }>): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unlimited'>();
  for (const entry of entries) quotaByUser.set(entry.user, entry.quota);

  return {
    quotaByUser,
    conflicts: new Map(),
    distinctQuotas: new Set(),
    hasMixedQuotas: false,
    hasMixedLicenses: false
  } as QuotaArtifacts;
}

function makeUsage(users: UserSummary[]): UsageArtifacts {
  const modelTotals: Record<string, number> = {};
  for (const u of users) {
    for (const [model, qty] of Object.entries(u.modelBreakdown)) {
      modelTotals[model] = (modelTotals[model] ?? 0) + qty;
    }
  }

  return {
    users: users.map(u => ({ user: u.user, totalRequests: u.totalRequests, modelBreakdown: u.modelBreakdown })),
    modelTotals,
    userCount: users.length,
    modelCount: Object.keys(modelTotals).length,
  };
}

describe('UsersOverview - sorting', () => {
  it('sorts by quota (including Unlimited) when clicking Quota header', () => {
    const userData: UserSummary[] = [
      { user: 'Alice', totalRequests: 10, modelBreakdown: { 'gpt-4': 10 } },
      { user: 'Bob', totalRequests: 20, modelBreakdown: { 'gpt-4': 20 } },
      { user: 'Charlie', totalRequests: 30, modelBreakdown: { 'gpt-4': 30 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'Alice', quota: 'unlimited' },
      { user: 'Bob', quota: PRICING.BUSINESS_QUOTA },
      { user: 'Charlie', quota: PRICING.ENTERPRISE_QUOTA },
    ]);

    const usageArtifacts = makeUsage(userData);

    const processedData: ProcessedData[] = [];
    const dailyCumulativeData = [
      {
        date: '2025-01-01T00:00:00Z',
        Alice: 1,
        Bob: 1,
        Charlie: 1,
      }
    ];

    render(
      <UsersOverview
        userData={userData}
        processedData={processedData}
        allModels={['gpt-4']}
        selectedPlan="business"
        dailyCumulativeData={dailyCumulativeData}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={usageArtifacts}
        onBack={() => {}}
      />
    );

    const table = screen.getByRole('table');

    const getRowUserOrder = (): string[] => {
      const rows = within(table).getAllByRole('row').slice(1); // skip header
      return rows.map(row => {
        const userButton = within(row).getByRole('button');
        return userButton.textContent ?? '';
      });
    };

    // Default sort is totalRequests desc.
    expect(getRowUserOrder()).toEqual(['Charlie', 'Bob', 'Alice']);

    const quotaHeader = within(table).getByText('Quota');
    const quotaTh = quotaHeader.closest('th');
    expect(quotaTh).toBeTruthy();

    // First click selects quota sorting desc: Unlimited first, then higher quotas.
    fireEvent.click(quotaTh as HTMLElement);
    expect(getRowUserOrder()).toEqual(['Alice', 'Charlie', 'Bob']);

    // Second click toggles to asc: lowest quota first, Unlimited last.
    fireEvent.click(quotaTh as HTMLElement);
    expect(getRowUserOrder()).toEqual(['Bob', 'Charlie', 'Alice']);
  });
});
