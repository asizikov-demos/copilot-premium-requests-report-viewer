import '@testing-library/jest-dom';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { UsersOverview } from '@/components/UsersOverview';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import type { QuotaArtifacts, UsageArtifacts } from '@/utils/ingestion';

import { makeProcessedData } from '../helpers/testUtils';

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
    for (const costCenter of u.costCenters ?? []) costCenters.add(costCenter);
  }

  return {
    users: users.map(u => ({
      user: u.user,
      totalCredits: u.totalCredits,
      modelBreakdown: u.modelBreakdown,
      organization: u.organization,
      costCenter: u.costCenter,
      costCenters: u.costCenters,
    })),
    modelTotals,
    userCount: users.length,
    modelCount: Object.keys(modelTotals).length,
    organizations: Array.from(organizations).sort((a, b) => a.localeCompare(b)),
    costCenters: Array.from(costCenters).sort((a, b) => a.localeCompare(b)),
  };
}

describe('UsersOverview - sorting', () => {
  it('hides monthly quota badges and chart thresholds when the report spans months', () => {
    const userData: UserSummary[] = [{
      user: 'test-user-one',
      totalCredits: 3000,
      modelBreakdown: { 'test-model-one': 3000 },
    }];
    const quotaArtifacts = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
    ]);
    const processedData = [
      makeProcessedData({ user: 'test-user-one', model: 'test-model-one',
        timestamp: new Date('2026-06-30T00:00:00Z'), creditsUsed: 1500 }),
      makeProcessedData({ user: 'test-user-one', model: 'test-model-one',
        timestamp: new Date('2026-07-01T00:00:00Z'), creditsUsed: 1500 }),
    ];
    const props = {
      userData,
      dailyCumulativeData: [
        { date: '2026-06-30', 'test-user-one': 1500 },
        { date: '2026-07-01', 'test-user-one': 1500 },
      ],
      quotaArtifacts,
      usageArtifacts: makeUsage(userData),
    };

    const { rerender } = render(<UsersOverview {...props} processedData={processedData} />);
    expect(screen.queryByText('1,900 quota')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Users' })).queryByText('(+1100.0)')).not.toBeInTheDocument();

    rerender(<UsersOverview {...props} processedData={[processedData[0]]} />);
    expect(screen.getByText('1,900 quota')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Users' })).getByText('(+1100.0)')).toBeInTheDocument();
  });

  it('shows a Copilot plan user summary above filters', () => {
    const userData: UserSummary[] = [
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'gpt-4': 10 } },
      { user: 'test-user-two', totalCredits: 20, modelBreakdown: { 'gpt-4': 20 } },
      { user: 'test-user-three', totalCredits: 30, modelBreakdown: { 'gpt-4': 30 } },
      { user: 'test-user-four', totalCredits: 5, modelBreakdown: { 'gpt-4': 5 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: 'unknown' },
    ]);

    render(
      <UsersOverview
        userData={userData}
        processedData={[]}
        dailyCumulativeData={[{ date: '2026-03-01T00:00:00Z', 'test-user-one': 10, 'test-user-two': 20, 'test-user-three': 30, 'test-user-four': 5 }]}
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
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'gpt-4': 10 } },
      { user: 'test-user-two', totalCredits: 20, modelBreakdown: { 'gpt-4': 20 } },
      { user: 'test-user-three', totalCredits: 30, modelBreakdown: { 'gpt-4': 30 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA },
    ]);

    const timestamp = new Date('2026-03-01T00:00:00Z');

    render(
      <UsersOverview
        userData={userData}
        processedData={[
          makeProcessedData({
            timestamp,
            user: 'test-user-one',
            model: 'Coding Agent model',
            creditsUsed: 10,
            quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
            grossAmount: 0.09,
            aicGrossAmount: 0.09,
          }),
          makeProcessedData({
            timestamp,
            user: 'test-user-two',
            model: 'Coding Agent model',
            creditsUsed: 20,
            quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
            grossAmount: 0.18,
            aicGrossAmount: 0.18,
          }),
          makeProcessedData({
            timestamp,
            user: 'test-user-three',
            model: 'Coding Agent model',
            creditsUsed: 30,
            quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
            grossAmount: 0.12,
            aicGrossAmount: 0.12,
          }),
        ]}
        dailyCumulativeData={[{
          date: '2026-03-01T00:00:00Z',
          'test-user-one': 10,
          'test-user-two': 20,
          'test-user-three': 30,
        }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    const table = screen.getByRole('table', { name: 'Users' });
    expect(within(table).getByRole('columnheader', { name: /Gross Amount/ })).toBeInTheDocument();
    expect(within(table).getByText('$0.18')).toBeInTheDocument();

    const getRowUserOrder = (): string[] => {
      const rows = within(table).getAllByRole('row').slice(1);
      return rows.map(row => within(row).getByRole('button').textContent ?? '');
    };

    const grossHeader = within(table).getByRole('columnheader', { name: /Gross Amount/ });
    fireEvent.click(grossHeader);
    expect(getRowUserOrder()).toEqual(['test-user-two', 'test-user-three', 'test-user-one']);
  });

  it('keeps AI-credit usage visible when monetary spend is zero', () => {
    const userData: UserSummary[] = [
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'gpt-4': 10 } },
    ];
    const quotaArtifacts = makeQuota([{ user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA }]);
    const timestamp = new Date('2026-03-01T00:00:00Z');
    const processedData: ProcessedData[] = [makeProcessedData({
      timestamp,
      user: 'test-user-one',
      model: 'gpt-4',
      creditsUsed: 10,
      quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      grossAmount: 0,
      aicGrossAmount: 0,
    })];

    render(
      <UsersOverview
        userData={userData}
        processedData={processedData}
        dailyCumulativeData={[{ date: '2026-03-01T00:00:00Z', 'test-user-one': 10 }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    const table = screen.getByRole('table', { name: 'Users' });
    expect(within(table).getByRole('columnheader', { name: /Total AI Credits/ })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: /Gross Amount/ })).not.toBeInTheDocument();
  });

  it('shows usage-based billing columns and hides request-only columns', () => {
    const userData: UserSummary[] = [
      { user: 'test-user-one', totalCredits: 0, modelBreakdown: {} },
      { user: 'test-user-two', totalCredits: 0, modelBreakdown: {} },
      { user: 'test-user-three', totalCredits: 0, modelBreakdown: {} },
    ];
    const quotaArtifacts = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: 'unknown' },
    ]);
    const timestamp = new Date('2026-06-01T00:00:00Z');

    render(
      <UsersOverview
        userData={userData}
        processedData={[
          makeProcessedData({
            timestamp,
            user: 'test-user-one',
            model: 'Auto: Claude Haiku 4.5',
            creditsUsed: 10,
            quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
            sku: 'copilot_ai_credit',
            unitType: 'ai-credits',
            usageUnit: 'ai_credit',
            billingQuantity: 0.1 / PRICING.AI_CREDIT_USD_VALUE,
            grossAmount: 0.1,
            discountAmount: 0.1,
            netAmount: 0,
            aicGrossAmount: 0.1,
          }),
          makeProcessedData({
            timestamp,
            user: 'test-user-two',
            model: 'Auto: Claude Haiku 4.5',
            creditsUsed: 20,
            quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
            sku: 'copilot_ai_credit',
            unitType: 'ai-credits',
            usageUnit: 'ai_credit',
            billingQuantity: 0.2 / PRICING.AI_CREDIT_USD_VALUE,
            grossAmount: 0.2,
            discountAmount: 0.2,
            netAmount: 0,
            aicGrossAmount: 0.2,
          }),
          makeProcessedData({
            timestamp,
            user: 'test-user-three',
            model: 'Auto: Claude Haiku 4.5',
            creditsUsed: 30,
            quotaValue: 'unknown',
            sku: 'copilot_ai_credit',
            unitType: 'ai-credits',
            usageUnit: 'ai_credit',
            billingQuantity: 0.3 / PRICING.AI_CREDIT_USD_VALUE,
            grossAmount: 0.3,
            discountAmount: 0.3,
            netAmount: 0,
            aicGrossAmount: 0.3,
          }),
        ]}
        dailyCumulativeData={[{
          date: '2026-06-01',
          'test-user-one': 10,
          'test-user-two': 20,
          'test-user-three': 30,
        }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    expect(screen.getByText('AI Credits Consumption')).toBeInTheDocument();
    expect(screen.getByText('Daily cumulative AI Credits usage')).toBeInTheDocument();
    expect(screen.getByText('AI Credits Used')).toBeInTheDocument();
    expect(screen.getByText('1,900 Business')).toBeInTheDocument();
    expect(screen.getByText('3,900 Enterprise')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Users' });
    expect(within(table).getByRole('columnheader', { name: /Quota/ })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Gross Amount/ })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: /Total Requests/ })).not.toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Total AI Credits/ })).toBeInTheDocument();
  });

  it('sorts by quota (including Unknown) when clicking Quota header', () => {
    const userData: UserSummary[] = [
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'gpt-4': 10 } },
      { user: 'test-user-two', totalCredits: 20, modelBreakdown: { 'gpt-4': 20 } },
      { user: 'test-user-three', totalCredits: 30, modelBreakdown: { 'gpt-4': 30 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'test-user-one', quota: 'unknown' },
      { user: 'test-user-two', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA },
    ]);

    const usageArtifacts = makeUsage(userData);

    const processedData: ProcessedData[] = [];
    const dailyCumulativeData = [
      {
        date: '2025-01-01T00:00:00Z',
        'test-user-one': 1,
        'test-user-two': 1,
        'test-user-three': 1,
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

    // Default sort is totalCredits desc.
    expect(getRowUserOrder()).toEqual(['test-user-three', 'test-user-two', 'test-user-one']);

    const quotaHeader = within(table).getByText('Quota');
    const quotaTh = quotaHeader.closest('th');
    expect(quotaTh).toBeTruthy();

    // First click selects quota sorting desc: higher known quotas first, Unknown last.
    fireEvent.click(quotaTh as HTMLElement);
    expect(getRowUserOrder()).toEqual(['test-user-three', 'test-user-two', 'test-user-one']);

    // Second click toggles to asc: Unknown first, then lowest known quota.
    fireEvent.click(quotaTh as HTMLElement);
    expect(getRowUserOrder()).toEqual(['test-user-one', 'test-user-two', 'test-user-three']);
  });

  it('filters users by organization and cost center when metadata is available', () => {
    const userData: UserSummary[] = [
      {
        user: 'test-user-one',
        totalCredits: 10,
        modelBreakdown: { 'model-one': 10 },
        organization: 'test-org-one',
        costCenter: 'test-cost-center-one',
        costCenters: ['test-cost-center-one', 'test-cost-center-two'],
      },
      { user: 'test-user-two', totalCredits: 20, modelBreakdown: { 'model-one': 20 }, organization: 'test-org-two', costCenter: 'test-cost-center-two' },
      { user: 'test-user-three', totalCredits: 15, modelBreakdown: { 'model-one': 15 }, organization: 'test-org-one', costCenter: 'test-cost-center-two' },
      { user: 'test-user-four', totalCredits: 5, modelBreakdown: { 'model-one': 5 } },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-three', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
    ]);

    render(
      <UsersOverview
        userData={userData}
        processedData={[]}
        dailyCumulativeData={[{
          date: '2025-01-01T00:00:00Z',
          'test-user-one': 1,
          'test-user-two': 1,
          'test-user-three': 1,
          'test-user-four': 1,
        }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    const table = screen.getByRole('table', { name: 'Users' });
    const getRowUserOrder = (): string[] => {
      const rows = within(table).getAllByRole('row').slice(1);
      return rows.map(row => within(row).getByRole('button').textContent ?? '');
    };

    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'test-org-one' } });
    expect(getRowUserOrder()).toEqual(['test-user-three', 'test-user-one']);

    fireEvent.change(screen.getByLabelText('Cost center'), { target: { value: 'test-cost-center-one' } });
    expect(getRowUserOrder()).toEqual(['test-user-one']);

    fireEvent.change(screen.getByLabelText('Cost center'), { target: { value: 'test-cost-center-two' } });
    expect(getRowUserOrder()).toEqual(['test-user-three', 'test-user-one']);

    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: '__all__' } });
    fireEvent.change(screen.getByLabelText('Cost center'), { target: { value: '__no_cost_centers__' } });
    expect(getRowUserOrder()).toEqual(['test-user-four']);
  });

  it('opens inline user details and returns via breadcrumb', () => {
    const userData: UserSummary[] = [
      { user: 'test-user-one', totalCredits: 10, modelBreakdown: { 'gpt-4': 10 }, organization: 'test-org-one', costCenter: 'test-cost-center-one' },
      { user: 'test-user-two', totalCredits: 20, modelBreakdown: { 'gpt-4': 20 }, organization: 'test-org-two', costCenter: 'test-cost-center-two' },
    ];

    const quotaArtifacts = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
      { user: 'test-user-two', quota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA },
    ]);

    const timestamp = new Date('2025-01-01T00:00:00Z');
    const processedData: ProcessedData[] = [
      makeProcessedData({
        timestamp,
        user: 'test-user-one',
        model: 'gpt-4',
        creditsUsed: 10,
        quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
        organization: 'test-org-one',
        costCenter: 'test-cost-center-one',
      }),
    ];

    render(
      <UsersOverview
        userData={userData}
        processedData={processedData}
        dailyCumulativeData={[{ date: '2025-01-01T00:00:00Z', 'test-user-one': 10, 'test-user-two': 20 }]}
        quotaArtifacts={quotaArtifacts}
        usageArtifacts={makeUsage(userData)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'test-user-one' }));
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'users' }));
    expect(screen.getByRole('table', { name: 'Users' })).toBeInTheDocument();
  });
});
