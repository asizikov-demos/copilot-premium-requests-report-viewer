import { render, screen, within } from '@testing-library/react';

import { AnalysisContext } from '@/context/AnalysisContext';
import { CodingAgentOverview } from '@/components/CodingAgentOverview';
import { PRICING } from '@/constants/pricing';
import type { CodeReviewAnalysis, CodingAgentUser, ProcessedData } from '@/types/csv';
import type {
  BillingArtifacts,
  DailyBucketsArtifacts,
  FeatureUsageArtifacts,
  QuotaArtifacts,
  UsageArtifacts,
} from '@/utils/ingestion';

function buildProcessedRow(partial: Partial<ProcessedData>): ProcessedData {
  const timestamp = new Date('2026-03-01T00:00:00Z');

  return {
    timestamp,
    user: 'test-user-one',
    model: 'Coding Agent model',
    requestsUsed: 0,
    exceedsQuota: false,
    totalQuota: String(PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
    quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
    iso: timestamp.toISOString(),
    dateKey: '2026-03-01',
    monthKey: '2026-03',
    epoch: timestamp.getTime(),
    usageUnit: 'ai_credit',
    billingQuantity: 0,
    ...partial,
  };
}

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

function createContextValue() {
  return {
    quotaArtifacts: {
      quotaByUser: new Map(),
      conflicts: new Map(),
      distinctQuotas: new Set(),
      hasMixedQuotas: false,
      hasMixedLicenses: false,
    } as QuotaArtifacts,
    usageArtifacts: {
      users: [],
      modelTotals: {},
      userCount: 0,
      modelCount: 0,
    } as UsageArtifacts,
    dailyBucketsArtifacts: {
      dailyUserTotals: new Map(),
      dailyUserModelTotals: new Map(),
      dateRange: { min: '2025-06-01', max: '2025-06-02' },
    } as DailyBucketsArtifacts,
    featureUsageArtifacts: {
      featureTotals: { codeReview: 0, codingAgent: 0, spark: 0 },
      featureUsers: { codeReview: new Set(), codingAgent: new Set(), spark: new Set() },
      specialTotals: { nonCopilotCodeReview: 0 },
    } as FeatureUsageArtifacts,
    billingArtifacts: undefined as BillingArtifacts | undefined,
    baseProcessed: [] as ProcessedData[],
    processedData: [] as ProcessedData[],
    aggregateProcessedData: [] as ProcessedData[],
    analysis: {
      timeFrame: { start: '', end: '' },
      totalUniqueUsers: 0,
      usersExceedingQuota: 0,
      requestsByModel: [],
      quotaBreakdown: { unknown: [], business: [], enterprise: [], mixed: false, suggestedPlan: null },
    },
    userData: [],
    allModels: [],
    dailyCumulativeData: [],
    dailyAicCumulativeData: [],
    codingAgentAnalysis: { totalUsers: 0, totalUniqueUsers: 0, totalCodingAgentRequests: 0, adoptionRate: 0, users: [] },
    codeReviewAnalysis: { totalUsers: 0, totalUniqueUsers: 0, totalCodeReviewRequests: 0, adoptionRate: 0, users: [] },
    weeklyExhaustion: { totalUsersExhausted: 0, weeks: [] },
    selectedMonths: [],
    setSelectedMonths: jest.fn(),
    availableMonths: [],
    hasMultipleMonthsData: false,
    selectedPlan: 'business' as const,
    view: 'codingAgent' as const,
    setView: jest.fn(),
    isDetailViewActive: true,
    chartData: [],
    planInfo: {
      business: { name: 'Copilot Business', monthlyQuota: 300 },
      enterprise: { name: 'Copilot Enterprise', monthlyQuota: 1000 },
    },
    filename: 'report.csv',
    onReset: jest.fn(),
  };
}

describe('CodingAgentOverview', () => {
  it('renders synthetic non-Copilot code review row with zero quota while keeping adoption copy on real users', () => {
    const codingAgentUsers: CodingAgentUser[] = [];
    const codeReviewAnalysis: CodeReviewAnalysis = {
      totalUsers: 2,
      totalUniqueUsers: 3,
      totalCodeReviewRequests: 17,
      adoptionRate: 66.67,
      users: [
        {
          user: 'test-user-one',
          totalRequests: 10,
          codeReviewRequests: 8,
          codeReviewPercentage: 80,
          quota: 300,
          models: ['Code Review beta'],
        },
        {
          user: 'test-user-two',
          totalRequests: 20,
          codeReviewRequests: 5,
          codeReviewPercentage: 25,
          quota: 'unknown',
          models: ['code review v1'],
        },
        {
          user: 'Non-Copilot Users',
          totalRequests: 4,
          codeReviewRequests: 4,
          codeReviewPercentage: 100,
          quota: 0,
          models: ['Code Review beta'],
          isSyntheticNonCopilotRow: true,
        },
      ],
    };

    render(
      <AnalysisContext.Provider value={createContextValue()}>
        <CodingAgentOverview
          codingAgentUsers={codingAgentUsers}
          totalUniqueUsers={0}
          adoptionRate={0}
          codeReviewAnalysis={codeReviewAnalysis}
        />
      </AnalysisContext.Provider>
    );

    expect(screen.getByText('67% adoption (2 of 3 users)')).toBeInTheDocument();

    const reviewHeading = screen.getByRole('heading', { name: 'Code Review Users' });
    const reviewTable = reviewHeading.parentElement?.nextElementSibling?.querySelector('table');
    expect(reviewTable).not.toBeNull();

    const table = reviewTable as HTMLTableElement;
    const syntheticRow = within(table).getByText('Non-Copilot Users').closest('tr');
    expect(syntheticRow).not.toBeNull();
    expect(within(syntheticRow as HTMLElement).getByText('4.0')).toBeInTheDocument();
    expect(within(syntheticRow as HTMLElement).getByText('0')).toBeInTheDocument();
  });

  it('renders usage-based agent tables in AI Credits with billing columns', () => {
    const aggregateProcessedData: ProcessedData[] = [
      buildProcessedRow({
        user: 'test-user-one',
        model: 'Coding Agent model',
        billingQuantity: 12.34,
        aicQuantity: 12.34,
        grossAmount: 0.1234,
        discountAmount: 0.1,
        netAmount: 0.0234,
      }),
      buildProcessedRow({
        user: 'test-user-one',
        model: 'Code Review model',
        billingQuantity: 3.5,
        aicQuantity: 3.5,
        grossAmount: 0.035,
        discountAmount: 0.01,
        netAmount: 0.025,
      }),
      buildProcessedRow({
        user: '',
        model: 'Code Review model',
        billingQuantity: 2,
        aicQuantity: 2,
        grossAmount: 0.02,
        discountAmount: 0,
        netAmount: 0.02,
        quotaValue: 0,
        isNonCopilotUsage: true,
        usageBucket: 'non_copilot_code_review',
      }),
    ];

    const dailyUserAicModelTotals = new Map<string, Map<string, Map<string, number>>>();
    dailyUserAicModelTotals.set('2026-03-01', new Map([
      ['test-user-one', new Map([
        ['Coding Agent model', 12.34],
        ['Code Review model', 3.5],
      ])],
    ]));

    const codingAgentUsers: CodingAgentUser[] = [
      {
        user: 'test-user-one',
        totalRequests: 0,
        codingAgentRequests: 0,
        codingAgentPercentage: 0,
        quota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
        models: ['Coding Agent model'],
      },
    ];
    const codeReviewAnalysis: CodeReviewAnalysis = {
      totalUsers: 1,
      totalUniqueUsers: 1,
      totalCodeReviewRequests: 0,
      adoptionRate: 100,
      users: [
        {
          user: 'test-user-one',
          totalRequests: 0,
          codeReviewRequests: 0,
          codeReviewPercentage: 0,
          quota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
          models: ['Code Review model'],
        },
        {
          user: 'Non-Copilot Users',
          totalRequests: 0,
          codeReviewRequests: 0,
          codeReviewPercentage: 0,
          quota: 0,
          models: ['Code Review model'],
          isSyntheticNonCopilotRow: true,
        },
      ],
    };

    render(
      <AnalysisContext.Provider
        value={{
          ...createContextValue(),
          aggregateProcessedData,
          dailyBucketsArtifacts: {
            dailyUserTotals: new Map(),
            dailyUserAicModelTotals,
            dateRange: { min: '2026-03-01', max: '2026-03-01' },
          } as DailyBucketsArtifacts,
        }}
      >
        <CodingAgentOverview
          codingAgentUsers={codingAgentUsers}
          totalUniqueUsers={1}
          adoptionRate={100}
          codeReviewAnalysis={codeReviewAnalysis}
        />
      </AnalysisContext.Provider>
    );

    expect(screen.getAllByText('Daily and cumulative AI Credits usage')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'AI Credits' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Gross Amount' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Included Credits' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Additional usage' })).toHaveLength(2);

    const agentHeading = screen.getByRole('heading', { name: 'Agent Users' });
    const agentTable = agentHeading.parentElement?.nextElementSibling?.querySelector('table') as HTMLTableElement;
    const agentRow = within(agentTable).getByText('test-user-one').closest('tr');
    expect(agentRow).not.toBeNull();
    expect(within(agentRow as HTMLElement).getByText('12.34')).toBeInTheDocument();
    expect(within(agentRow as HTMLElement).getByText('$0.12')).toBeInTheDocument();
    expect(within(agentRow as HTMLElement).getByText('-$0.10')).toBeInTheDocument();
    expect(within(agentRow as HTMLElement).getByText('$0.02')).toBeInTheDocument();

    const reviewHeading = screen.getByRole('heading', { name: 'Code Review Users' });
    const reviewTable = reviewHeading.parentElement?.nextElementSibling?.querySelector('table') as HTMLTableElement;
    const syntheticRow = within(reviewTable).getByText('Non-Copilot Users').closest('tr');
    expect(syntheticRow).not.toBeNull();
    expect(within(syntheticRow as HTMLElement).getByText('2.00')).toBeInTheDocument();
    expect(within(syntheticRow as HTMLElement).getAllByText('$0.02')).toHaveLength(2);
  });
});
