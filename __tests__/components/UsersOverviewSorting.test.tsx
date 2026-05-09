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

function makeQuota(entries: Array<{ user: string; quota: number | 'unknown' }>): QuotaArtifacts {
  const quotaByUser = new Map<string, number | 'unknown'>();
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
  const organizations = new Set<string>();
  const costCenters = new Set<string>();
  for (const u of users) {
    for (const [model, qty] of Object.entries(u.modelBreakdown)) {
      modelTotals[model] = (modelTotals[model] ?? 0) + qty;
    }
    if (u.organization) organizations.add(u.organization);
    if (u.costCenter) costCenters.add(u.costCenter);
  }

  return {
    users: users.map(u => ({
      user: u.user,
      totalRequests: u.totalRequests,
      modelBreakdown: u.modelBreakdown,
      organization: u.organization,
      costCenter: u.costCenter
    })),
    modelTotals,
    userCount: users.length,
    modelCount: Object.keys(modelTotals).length,
    organizations: Array.from(organizations).sort((a, b) => a.localeCompare(b)),
    costCenters: Array.from(costCenters).sort((a, b) => a.localeCompare(b)),
  };
}

describe('UsersOverview - sorting', () => {
  it('shows a Copilot plan user summary above filters', () => {
    const userData: UserSummary[] = [
      { user: 'Alice', totalRequests: 10, modelBreakdown: { 'gpt-4': 10 } },
      { user: 'Bob', totalRequests: 20, modelBreakdown: { 'gpt-4': 20 } },
      { user: 'Charlie', totalRequests: 30, modelBreakdown: { 'gpt-4': 30 } },
      { user: 'Dana', totalRequests: 5, modelBreakdown: { 'gpt-4': 5 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'Alice', quota: PRICING.BUSINESS_QUOTA },
      { user: 'Bob', quota: PRICING.ENTERPRISE_QUOTA },
      { user: 'Charlie', quota: 'unknown' },
    ]);

    render(
      <UsersOverview
        userData={userData}
        processedData={[]}
        dailyCumulativeData={[{ date: '2026-03-01T00:00:00Z', Alice: 10, Bob: 20, Charlie: 30, Dana: 5 }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    const summaryTable = screen.getByRole('table', { name: 'Copilot plan summary' });
    const rows = within(summaryTable).getAllByRole('row').slice(1);

    expect(within(rows[0]).getByText('Copilot Business')).toBeInTheDocument();
    expect(within(rows[0]).getByText('1 user')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Copilot Enterprise')).toBeInTheDocument();
    expect(within(rows[1]).getByText('1 user')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Others')).toBeInTheDocument();
    expect(within(rows[2]).getByText('2 users')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Total')).toBeInTheDocument();
    expect(within(rows[3]).getByText('4 users')).toBeInTheDocument();
  });

  it('shows and sorts AI Credits Gross when AIC data is present', () => {
    const userData: UserSummary[] = [
      { user: 'Alice', totalRequests: 10, modelBreakdown: { 'gpt-4': 10 } },
      { user: 'Bob', totalRequests: 20, modelBreakdown: { 'gpt-4': 20 } },
      { user: 'Charlie', totalRequests: 30, modelBreakdown: { 'gpt-4': 30 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'Alice', quota: PRICING.BUSINESS_QUOTA },
      { user: 'Bob', quota: PRICING.BUSINESS_QUOTA },
      { user: 'Charlie', quota: PRICING.ENTERPRISE_QUOTA },
    ]);

    const timestamp = new Date('2026-03-01T00:00:00Z');
    const makeProcessedRow = (user: string, requestsUsed: number, aicGrossAmount: number): ProcessedData => ({
      timestamp,
      user,
      model: 'Coding Agent model',
      requestsUsed,
      exceedsQuota: false,
      totalQuota: '1000',
      quotaValue: PRICING.ENTERPRISE_QUOTA,
      iso: timestamp.toISOString(),
      dateKey: '2026-03-01',
      monthKey: '2026-03',
      epoch: timestamp.getTime(),
      aicGrossAmount,
    });

    render(
      <UsersOverview
        userData={userData}
        processedData={[
          makeProcessedRow('Alice', 10, 0.09),
          makeProcessedRow('Bob', 20, 0.18),
          makeProcessedRow('Charlie', 30, 0.12),
        ]}
        dailyCumulativeData={[{ date: '2026-03-01T00:00:00Z', Alice: 10, Bob: 20, Charlie: 30 }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
        onBack={() => {}}
      />
    );

    const table = screen.getByRole('table', { name: 'Users' });
    expect(within(table).getByRole('columnheader', { name: /AI Credits Gross/ })).toBeInTheDocument();
    expect(within(table).getByText('$0.18')).toBeInTheDocument();

    const getRowUserOrder = (): string[] => {
      const rows = within(table).getAllByRole('row').slice(1);
      return rows.map(row => within(row).getByRole('button').textContent ?? '');
    };

    const aicGrossHeader = within(table).getByRole('columnheader', { name: /AI Credits Gross/ });
    fireEvent.click(aicGrossHeader);
    expect(getRowUserOrder()).toEqual(['Bob', 'Charlie', 'Alice']);
  });

  it('shows AI Credits Gross when the new report fields are present with zero spend', () => {
    const userData: UserSummary[] = [
      { user: 'Alice', totalRequests: 10, modelBreakdown: { 'gpt-4': 10 } },
    ];
    const quotaArtifacts = makeQuota([{ user: 'Alice', quota: PRICING.BUSINESS_QUOTA }]);
    const timestamp = new Date('2026-03-01T00:00:00Z');
    const processedData: ProcessedData[] = [{
      timestamp,
      user: 'Alice',
      model: 'gpt-4',
      requestsUsed: 10,
      exceedsQuota: false,
      totalQuota: '300',
      quotaValue: PRICING.BUSINESS_QUOTA,
      iso: timestamp.toISOString(),
      dateKey: '2026-03-01',
      monthKey: '2026-03',
      epoch: timestamp.getTime(),
      aicGrossAmount: 0,
    }];

    render(
      <UsersOverview
        userData={userData}
        processedData={processedData}
        dailyCumulativeData={[{ date: '2026-03-01T00:00:00Z', Alice: 10 }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
        onBack={() => {}}
      />
    );

    const table = screen.getByRole('table', { name: 'Users' });
    expect(within(table).getByRole('columnheader', { name: /AI Credits Gross/ })).toBeInTheDocument();
    expect(within(table).getByText('$0.00')).toBeInTheDocument();
  });

  it('sorts by quota (including Unknown) when clicking Quota header', () => {
    const userData: UserSummary[] = [
      { user: 'Alice', totalRequests: 10, modelBreakdown: { 'gpt-4': 10 } },
      { user: 'Bob', totalRequests: 20, modelBreakdown: { 'gpt-4': 20 } },
      { user: 'Charlie', totalRequests: 30, modelBreakdown: { 'gpt-4': 30 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'Alice', quota: 'unknown' },
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
        dailyCumulativeData={dailyCumulativeData}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={usageArtifacts}
      />
    );

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Users' });

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

    // First click selects quota sorting desc: higher known quotas first, Unknown last.
    fireEvent.click(quotaTh as HTMLElement);
    expect(getRowUserOrder()).toEqual(['Charlie', 'Bob', 'Alice']);

    // Second click toggles to asc: Unknown first, then lowest known quota.
    fireEvent.click(quotaTh as HTMLElement);
    expect(getRowUserOrder()).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('filters users by organization and cost center when metadata is available', () => {
    const userData: UserSummary[] = [
      { user: 'Alice', totalRequests: 10, modelBreakdown: { 'gpt-4': 10 }, organization: 'Org A', costCenter: 'Platform' },
      { user: 'Bob', totalRequests: 20, modelBreakdown: { 'gpt-4': 20 }, organization: 'Org B', costCenter: 'Security' },
      { user: 'Charlie', totalRequests: 15, modelBreakdown: { 'gpt-4': 15 }, organization: 'Org A', costCenter: 'Security' },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'Alice', quota: PRICING.BUSINESS_QUOTA },
      { user: 'Bob', quota: PRICING.BUSINESS_QUOTA },
      { user: 'Charlie', quota: PRICING.BUSINESS_QUOTA },
    ]);

    render(
      <UsersOverview
        userData={userData}
        processedData={[]}
        dailyCumulativeData={[{ date: '2025-01-01T00:00:00Z', Alice: 1, Bob: 1, Charlie: 1 }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    const table = screen.getByRole('table', { name: 'Users' });
    const getRowUserOrder = (): string[] => {
      const rows = within(table).getAllByRole('row').slice(1);
      return rows.map(row => within(row).getByRole('button').textContent ?? '');
    };

    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'Org A' } });
    expect(getRowUserOrder()).toEqual(['Charlie', 'Alice']);

    fireEvent.change(screen.getByLabelText('Cost center'), { target: { value: 'Security' } });
    expect(getRowUserOrder()).toEqual(['Charlie']);
  });

  it('opens inline user details and returns via breadcrumb', () => {
    const userData: UserSummary[] = [
      { user: 'Alice', totalRequests: 10, modelBreakdown: { 'gpt-4': 10 }, organization: 'Org A', costCenter: 'Platform' },
      { user: 'Bob', totalRequests: 20, modelBreakdown: { 'gpt-4': 20 }, organization: 'Org B', costCenter: 'Security' },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'Alice', quota: PRICING.BUSINESS_QUOTA },
      { user: 'Bob', quota: PRICING.ENTERPRISE_QUOTA },
    ]);

    const timestamp = new Date('2025-01-01T00:00:00Z');
    const iso = timestamp.toISOString();
    const processedData: ProcessedData[] = [
      {
        timestamp,
        user: 'Alice',
        model: 'gpt-4',
        requestsUsed: 10,
        exceedsQuota: false,
        totalQuota: '300',
        quotaValue: PRICING.BUSINESS_QUOTA,
        iso,
        dateKey: iso.slice(0, 10),
        monthKey: iso.slice(0, 7),
        epoch: timestamp.getTime(),
        organization: 'Org A',
        costCenter: 'Platform',
      },
    ];

    render(
      <UsersOverview
        userData={userData}
        processedData={processedData}
        dailyCumulativeData={[{ date: '2025-01-01T00:00:00Z', Alice: 10, Bob: 20 }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alice' }));
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'users' }));
    expect(screen.getByRole('table', { name: 'Users' })).toBeInTheDocument();
  });
});
