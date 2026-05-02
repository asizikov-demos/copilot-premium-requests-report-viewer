import { render, screen, within } from '@testing-library/react';

import { AnalysisContext } from '@/context/AnalysisContext';
import { CodingAgentOverview } from '@/components/CodingAgentOverview';
import type { CodeReviewAnalysis, CodingAgentUser, ProcessedData } from '@/types/csv';
import type {
  BillingArtifacts,
  DailyBucketsArtifacts,
  FeatureUsageArtifacts,
  QuotaArtifacts,
  UsageArtifacts,
} from '@/utils/ingestion';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
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
      quotaBreakdown: { unlimited: [], business: [], enterprise: [], mixed: false, suggestedPlan: null },
    },
    userData: [],
    allModels: [],
    dailyCumulativeData: [],
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
          quota: 'unlimited',
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
});
