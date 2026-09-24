import { render, screen } from '@testing-library/react';

import { CostOptimizationInsights } from '@/components/CostOptimizationInsights';
import { PRICING } from '@/constants/pricing';
import { useAnalysisContext } from '@/context/AnalysisContext';
import type { BillingArtifacts, QuotaArtifacts, UsageArtifacts } from '@/utils/ingestion';

jest.mock('@/context/AnalysisContext', () => ({ useAnalysisContext: jest.fn() }));

const mockContext = jest.mocked(useAnalysisContext);

function setContext({ selectedMonths = [], dailyUserTotals, credits = PRICING.BUSINESS_AI_CREDIT_QUOTA + 700, net = 30 }: {
  selectedMonths?: string[];
  dailyUserTotals?: Map<string, Map<string, number>>;
  credits?: number;
  net?: number;
}) {
  const usageArtifacts: UsageArtifacts = {
    users: [{
      user: 'test-user-one',
      totalCredits: credits,
      modelBreakdown: { 'model-a': credits }
    }],
    modelTotals: { 'model-a': credits },
    userCount: 1,
    modelCount: 1
  };
  const quotaArtifacts: QuotaArtifacts = {
    quotaByUser: new Map([['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA]]),
    conflicts: new Map(),
    distinctQuotas: new Set([PRICING.BUSINESS_AI_CREDIT_QUOTA]),
    hasMixedQuotas: false,
    hasMixedLicenses: false
  };
  const userMap = new Map([['test-user-one', { user: 'test-user-one', quantity: 0, net }]]);
  const billingArtifacts: BillingArtifacts = {
    totals: { gross: 0, discount: 0, net, aicQuantity: 0, aicGrossAmount: 0 },
    users: Array.from(userMap.values()),
    userMap,
    orgTotals: new Map(),
    costCenterTotals: new Map(),
    billingByModel: new Map(),
    hasAnyBillingData: true,
    hasAnyAicData: true
  };

  mockContext.mockReturnValue({
    usageArtifacts,
    quotaArtifacts,
    billingArtifacts,
    dailyBucketsArtifacts: { dailyUserTotals },
    selectedMonths
  } as ReturnType<typeof useAnalysisContext>);
}

describe('CostOptimizationInsights', () => {
  it('reports billed net amounts with budget actions, not an upgrade savings claim', () => {
    setContext({});
    render(<CostOptimizationInsights />);

    expect(screen.getByText('Review usage and budgets')).toBeInTheDocument();
    expect(screen.getAllByText('$30.00')).toHaveLength(2);
    expect(screen.getByText('700.00')).toBeInTheDocument();
    expect(screen.queryByText(/upgrade|savings|per-request/i)).not.toBeInTheDocument();
  });

  it('uses the context-provided period-scoped usage and billing without recomputing credits', () => {
    const dailyUserTotals = new Map([
      ['2026-06-30', new Map([['test-user-one', 100]])],
      ['2026-07-01', new Map([['test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA + 700]])]
    ]);
    setContext({ selectedMonths: ['2026-07'], dailyUserTotals });
    const { rerender } = render(<CostOptimizationInsights />);
    expect(screen.getByText('700.00')).toBeInTheDocument();

    setContext({ selectedMonths: ['2026-06'], credits: 100, dailyUserTotals, net: 2 });
    rerender(<CostOptimizationInsights />);
    expect(screen.queryByText('700.00')).not.toBeInTheDocument();
    expect(screen.getByText(/No billed Business users exceeded/)).toBeInTheDocument();

    setContext({ selectedMonths: [], dailyUserTotals });
    rerender(<CostOptimizationInsights />);
    expect(screen.getByText(/Cost monitoring unavailable/)).toBeInTheDocument();
  });
});
