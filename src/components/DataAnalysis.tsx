'use client';

import React, { useMemo } from 'react';
import { ModelRequestsBarChart } from './charts/ModelRequestsBarChart';
import { ModelUsageTrendsOverview } from './ModelUsageTrendsOverview';
import { UsersOverview } from './UsersOverview';
import { CodingAgentOverview } from './CodingAgentOverview';
import { InsightsOverview } from './InsightsOverview';
import { CostOptimizationInsights } from './CostOptimizationInsights';
import { PRICING } from '@/constants/pricing';
import { AnalysisProvider, useAnalysisContext } from '@/context/AnalysisContext';
import { getModelColor } from '@/utils/modelColors';

interface DataAnalysisProps {
  ingestionResult: import('@/utils/ingestion').IngestionResult;
  filename: string;
  onReset: () => void;
}

const NAV_ITEMS = [
  {
    key: 'overview' as const,
    label: 'Overview',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    key: 'users' as const,
    label: 'Users',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    key: 'codingAgent' as const,
    label: 'Agent Adoption',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
  },
  {
    key: 'insights' as const,
    label: 'Insights',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
  },
  {
    key: 'costOptimization' as const,
    label: 'Cost Optimization',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'modelTrends' as const,
    label: 'Models',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
  },
];

function DataAnalysisInner() {
  const {
    view,
    setView,
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    codingAgentAnalysis,
    codeReviewAnalysis,
    processedData,
    weeklyExhaustion,
    availableMonths,
    hasMultipleMonthsData,
    selectedMonths,
    setSelectedMonths,
    planInfo,
    selectedPlan,
    chartData,
    filename,
    quotaArtifacts,
    usageArtifacts,
    billingArtifacts
  } = useAnalysisContext();

  const processedCosts = useMemo(() => {
    const hasBillingData = processedData.some(
      (row) =>
        row.netAmount !== undefined ||
        row.grossAmount !== undefined ||
        row.discountAmount !== undefined
    );

    if (!hasBillingData) {
      return null;
    }

    return processedData.reduce((acc, row) => {
      acc.net += row.netAmount ?? 0;
      acc.gross += row.grossAmount ?? 0;
      acc.discount += row.discountAmount ?? 0;
      return acc;
    }, { net: 0, gross: 0, discount: 0 });
  }, [processedData]);

  const costMetricsAvailable = processedCosts !== null || billingArtifacts?.hasAnyBillingData === true;
  const aggregatedCosts = processedCosts ?? (billingArtifacts?.hasAnyBillingData ? billingArtifacts.totals : null);

  const modelRows = useMemo(() => {
    const map = new Map<string, { model: string; requests: number; gross: number; discount: number; net: number }>();
    for (const row of processedData) {
      const prev = map.get(row.model) ?? {
        model: row.model,
        requests: 0,
        gross: 0,
        discount: 0,
        net: 0,
      };
      prev.requests += row.requestsUsed;
      prev.gross += row.grossAmount ?? 0;
      prev.discount += row.discountAmount ?? 0;
      prev.net += row.netAmount ?? 0;
      map.set(row.model, prev);
    }
    return Array.from(map.values()).sort((left, right) => right.requests - left.requests);
  }, [processedData]);

  const hasModelCosts = modelRows.some(
    (row) => row.gross > 0 || row.discount > 0 || row.net > 0
  );

  // Per-product cost aggregation (Coding Agent, Code Review, Copilot)
  type ProductCost = { label: string; requests: number; gross: number; discount: number; net: number };
  const productCosts = useMemo((): ProductCost[] => {
    const buckets = {
      codingAgent: { label: 'Coding Agent', requests: 0, gross: 0, discount: 0, net: 0 },
      codeReview: { label: 'Code Review', requests: 0, gross: 0, discount: 0, net: 0 },
      copilot: { label: 'Copilot', requests: 0, gross: 0, discount: 0, net: 0 },
    };
    for (const row of processedData) {
      const m = row.model.toLowerCase();
      const bucket = m.includes('coding agent') || m.includes('padawan')
        ? buckets.codingAgent
        : m.includes('code review')
          ? buckets.codeReview
          : buckets.copilot;
      bucket.requests += row.requestsUsed;
      bucket.gross += row.grossAmount ?? 0;
      bucket.discount += row.discountAmount ?? 0;
      bucket.net += row.netAmount ?? 0;
    }
    return [buckets.copilot, buckets.codingAgent, buckets.codeReview].filter(b => b.requests > 0);
  }, [processedData]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="display-heading text-3xl lg:text-4xl text-stone-900">Analysis Results</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-stone-500 font-medium">
                {analysis.timeFrame.start} — {analysis.timeFrame.end}
              </span>
              <span className="w-1 h-1 rounded-full bg-stone-300"></span>
              <span className="font-mono text-xs px-2 py-1 bg-stone-100 rounded-md text-stone-600">{filename}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden mb-6">
        <div className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                view === item.key
                  ? 'bg-stone-900 text-white shadow-md'
                  : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:border-stone-300'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Layout: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="glass-panel rounded-2xl sticky top-24 opacity-0 animate-slide-in-right" style={{ animationDelay: '100ms' }}>
            {/* Navigation */}
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    view === item.key
                      ? 'bg-stone-900 text-white shadow-md'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Billing Period Filter */}
            {hasMultipleMonthsData && (
              <div className="border-t border-stone-200/60 p-4">
                <label htmlFor="billing-period" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  Billing Period
                </label>
                <select
                  id="billing-period"
                  multiple
                  value={selectedMonths}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedMonths(selected);
                  }}
                  className="block w-full px-3 py-2 text-sm text-stone-900 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
                  size={Math.min(availableMonths.length, 4)}
                >
                  {availableMonths.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-stone-400">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {view === 'users' ? (
            <UsersOverview
              userData={userData}
              processedData={processedData}
              allModels={allModels}
              dailyCumulativeData={dailyCumulativeData}
              quotaArtifacts={quotaArtifacts}
              usageArtifacts={usageArtifacts}
            />
          ) : view === 'codingAgent' ? (
            <CodingAgentOverview
              codingAgentUsers={codingAgentAnalysis.users}
              totalUniqueUsers={codingAgentAnalysis.totalUniqueUsers}
              adoptionRate={codingAgentAnalysis.adoptionRate}
              codeReviewAnalysis={codeReviewAnalysis}
            />
          ) : view === 'insights' ? (
            <InsightsOverview
              userData={userData}
              processedData={processedData}
            />
          ) : view === 'costOptimization' ? (
            <CostOptimizationInsights />
          ) : view === 'modelTrends' ? (
            <ModelUsageTrendsOverview />
          ) : (
            /* Overview — chart + model table */
            <div className="space-y-6">
              {/* Cost per Product */}
              {productCosts.length > 0 && costMetricsAvailable && (
                <div className="card-elevated rounded-2xl overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  <div className="px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-transparent">
                    <h3 className="text-lg font-semibold text-stone-900">Cost per Product</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-stone-100">
                          <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Requests</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Gross</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Discount</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {productCosts.map((product) => (
                          <tr key={product.label} className="table-row-hover transition-colors">
                            <td className="px-6 py-3.5 text-sm font-medium text-stone-900">{product.label}</td>
                            <td className="px-6 py-3.5 text-sm text-stone-600 text-right font-mono">{product.requests.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-sm text-stone-600 text-right font-mono">${product.gross.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-sm text-emerald-600 text-right font-mono">-${product.discount.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-sm font-semibold text-stone-900 text-right font-mono">${product.net.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="card-elevated rounded-2xl p-6 opacity-0 animate-scale-in" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-stone-900">Requests by Model</h3>
                  <span className="text-xs text-stone-400 font-medium">Total: {analysis.requestsByModel.reduce((sum, m) => sum + m.totalRequests, 0).toFixed(0)} requests</span>
                </div>
                <div className="h-72 xl:h-80 2xl:h-96">
                  <ModelRequestsBarChart data={chartData} />
                </div>
              </div>

              <div className="card-elevated rounded-2xl overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-transparent">
                  <h3 className="text-lg font-semibold text-stone-900">Model Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">Model</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Requests</th>
                        {hasModelCosts && (
                          <>
                            <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Gross</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Discount</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">Net</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {modelRows.map((item, index) => {
                        return (
                          <tr key={index} className="table-row-hover transition-colors">
                            <td className="px-6 py-3.5 text-sm font-medium text-stone-900">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getModelColor(item.model) }}></div>
                                {item.model}
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-sm text-stone-600 text-right font-mono">
                              {item.requests.toFixed(2)}
                            </td>
                            {hasModelCosts && (
                              <>
                                <td className="px-6 py-3.5 text-sm text-stone-600 text-right font-mono">
                                  ${item.gross.toFixed(2)}
                                </td>
                                <td className="px-6 py-3.5 text-sm text-emerald-600 text-right font-mono">
                                  -${item.discount.toFixed(2)}
                                </td>
                                <td className="px-6 py-3.5 text-sm font-semibold text-stone-900 text-right font-mono">
                                  ${item.net.toFixed(2)}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Summary Panel */}
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="glass-panel rounded-2xl p-5 sticky top-24 opacity-0 animate-slide-in-right" style={{ animationDelay: '250ms' }}>
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Summary</h3>

              {/* Quota Breakdown */}
              {analysis.quotaBreakdown.mixed && (
                <div className="badge-amber p-3 rounded-xl">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Mixed Licenses</p>
                  <div className="text-xs text-amber-700 space-y-1">
                    {analysis.quotaBreakdown.business.length > 0 && (
                      <p className="flex justify-between">
                        <span>Business ({PRICING.BUSINESS_QUOTA})</span>
                        <span className="font-semibold">{analysis.quotaBreakdown.business.length}</span>
                      </p>
                    )}
                    {analysis.quotaBreakdown.enterprise.length > 0 && (
                      <p className="flex justify-between">
                        <span>Enterprise ({PRICING.ENTERPRISE_QUOTA})</span>
                        <span className="font-semibold">{analysis.quotaBreakdown.enterprise.length}</span>
                      </p>
                    )}
                    {analysis.quotaBreakdown.unlimited.length > 0 && (
                      <p className="flex justify-between">
                        <span>Unlimited</span>
                        <span className="font-semibold">{analysis.quotaBreakdown.unlimited.length}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                <span className="text-xs font-medium text-stone-500">Monthly Quota</span>
                <span className="text-sm font-bold text-stone-900">
                  {analysis.quotaBreakdown.mixed
                    ? 'Mixed'
                    : planInfo[selectedPlan].monthlyQuota
                  }
                </span>
              </div>

              {analysis.quotaBreakdown.suggestedPlan && !analysis.quotaBreakdown.mixed && (
                <div className="badge-blue p-3 rounded-xl">
                  <p className="text-xs">
                    Auto-selected <span className="font-semibold">{planInfo[analysis.quotaBreakdown.suggestedPlan].name}</span>
                  </p>
                </div>
              )}

              {/* Weekly Exhaustion Breakdown */}
              {weeklyExhaustion.weeks.length > 0 && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <p className="text-xs font-semibold text-stone-700 mb-2">Weekly Exhaustion</p>
                  <p className="text-xs text-stone-500 mb-3">Users exhausting quota by week</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-stone-100">
                      <span className="font-semibold text-stone-700">Total</span>
                      <span className="font-bold text-orange-600">{weeklyExhaustion.totalUsersExhausted}</span>
                    </div>
                    {weeklyExhaustion.weeks.map(w => (
                      <div key={`${w.weekNumber}-${w.startDate}`} className="flex justify-between text-stone-600">
                        <span>Week {w.weekNumber}</span>
                        <span className="font-medium">{w.usersExhaustedInWeek}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Metrics */}
              {costMetricsAvailable && aggregatedCosts && (
                <div className="p-4 bg-gradient-to-br from-stone-50 to-stone-100 rounded-xl border border-stone-200">
                  <p className="text-xs font-bold text-stone-700 mb-3">Billing Summary</p>
                  <div className="space-y-2 text-sm" aria-label="billing-summary">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Gross</span>
                      <span className="font-mono font-medium text-stone-700">${aggregatedCosts.gross.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Discounts</span>
                      <span className="font-mono font-medium text-emerald-600">-${aggregatedCosts.discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 mt-2 border-t-2 border-stone-200">
                      <span className="text-stone-900 font-bold">Net</span>
                      <span className="font-mono font-bold text-stone-900 text-base">${aggregatedCosts.net.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DataAnalysis(props: DataAnalysisProps) {
  const { ingestionResult, filename, onReset } = props;
  return (
    <AnalysisProvider ingestionResult={ingestionResult} filename={filename} onReset={onReset}>
      <DataAnalysisInner />
    </AnalysisProvider>
  );
}
