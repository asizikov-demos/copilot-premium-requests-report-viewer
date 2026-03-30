'use client';

import React, { useEffect, useMemo } from 'react';
import { ModelRequestsBarChart } from './charts/ModelRequestsBarChart';
import { ModelUsageTrendsOverview } from './ModelUsageTrendsOverview';
import { UsersOverview } from './UsersOverview';
import { CodingAgentOverview } from './CodingAgentOverview';
import { InsightsOverview } from './InsightsOverview';
import { CostOptimizationInsights } from './CostOptimizationInsights';
import { CostCentersOverview } from './CostCentersOverview';
import { PRICING } from '@/constants/pricing';
import { AnalysisProvider, useAnalysisContext } from '@/context/AnalysisContext';
import { getModelColor } from '@/utils/modelColors';
import { classifyProductCategory } from '@/utils/productClassification';

interface DataAnalysisProps {
  ingestionResult: import('@/utils/ingestion').IngestionResult;
  filename: string;
  onReset: () => void;
}

type NavigationItem = {
  key: 'overview' | 'users' | 'costCenters' | 'codingAgent' | 'insights' | 'costOptimization' | 'modelTrends';
  label: string;
  icon: React.ReactNode;
};

const COST_CENTERS_NAV_ITEM: NavigationItem = {
  key: 'costCenters' as const,
  label: 'Cost Centers',
  icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
    </svg>
  ),
};

const NAV_ITEMS: NavigationItem[] = [
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
    baseProcessed,
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

  const hasCostCenters = useMemo(() => {
    return baseProcessed.some((row) => row.costCenter);
  }, [baseProcessed]);

  useEffect(() => {
    if (!hasCostCenters && view === 'costCenters') {
      setView('overview');
    }
  }, [hasCostCenters, setView, view]);

  const navItems = useMemo(() => {
    const items = [...NAV_ITEMS];
    if (hasCostCenters) {
      // Insert after 'users' (index 1)
      items.splice(2, 0, COST_CENTERS_NAV_ITEM);
    }
    return items;
  }, [hasCostCenters]);

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

  // Per-product cost aggregation (Cloud Agent, Code Review, Copilot)
  type ProductCost = { label: string; requests: number; gross: number; discount: number; net: number };
  const productCosts = useMemo((): ProductCost[] => {
    const buckets = {
      codingAgent: { label: 'Cloud Agent', requests: 0, gross: 0, discount: 0, net: 0 },
      codeReview: { label: 'Code Review', requests: 0, gross: 0, discount: 0, net: 0 },
      copilot: { label: 'Copilot', requests: 0, gross: 0, discount: 0, net: 0 },
    };
    for (const row of processedData) {
      const productCategory = classifyProductCategory(row.model);
      const bucket = productCategory === 'Coding Agent'
        ? buckets.codingAgent
        : productCategory === 'Code Review'
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
      {/* Info Bar — attached to header */}
      <div className="-mx-6 -mt-8 mb-6 px-6 py-3 bg-[#f6f8fa] border-b border-[#d1d9e0]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#636c76]">
          <span>File: <span className="font-semibold text-[#1f2328]">{filename}</span></span>
          <span className="hidden sm:inline text-[#d1d9e0]">|</span>
          <span>Report window: <span className="font-semibold text-[#1f2328]">{analysis.timeFrame.start} to {analysis.timeFrame.end}</span></span>
          <span className="hidden sm:inline text-[#d1d9e0]">|</span>
          <span>Total rows: <span className="font-semibold text-[#1f2328]">{processedData.length.toLocaleString()}</span></span>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden mb-6">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                view === item.key
                  ? 'bg-white text-[#1f2328] shadow-sm border-b-2 border-indigo-500 font-semibold'
                  : 'bg-white text-[#636c76] hover:bg-[#f6f8fa] border border-[#d1d9e0] hover:border-[#d1d9e0]'
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
          <div className="bg-white border border-[#d1d9e0] rounded-md sticky top-24 opacity-0 animate-slide-in-right" style={{ animationDelay: '100ms' }}>
            {/* Navigation */}
            <nav className="p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                    view === item.key
                      ? 'bg-[#f6f8fa] text-[#1f2328] font-semibold'
                      : 'text-[#636c76] hover:bg-[#f6f8fa] hover:text-[#1f2328]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Billing Period Filter */}
            {hasMultipleMonthsData && (
              <div className="border-t border-[#d1d9e0] p-4">
                <label htmlFor="billing-period" className="block text-xs font-bold text-[#636c76] uppercase tracking-wider mb-2">
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
                  className="block w-full px-3 py-2 text-sm text-[#1f2328] bg-white border border-[#d1d9e0] rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                  size={Math.min(availableMonths.length, 4)}
                >
                  {availableMonths.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[#636c76]">
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
          ) : view === 'costCenters' ? (
            <CostCentersOverview />
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
              {/* Current Billing + Licenses row */}
              {costMetricsAvailable && aggregatedCosts && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                  {/* Current Billing */}
                  <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
                    <p className="text-xs font-bold text-[#636c76] uppercase tracking-wider text-center mb-3">Current Billing</p>
                    <p className="text-3xl font-bold text-[#1f2328] text-center">
                      ${aggregatedCosts.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-[#636c76] text-center mt-1">
                      {processedData.reduce((sum, r) => sum + r.requestsUsed, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PRUs
                    </p>
                    <p className="text-xs text-[#636c76] text-center mt-0.5">
                      1 PRU = ${PRICING.OVERAGE_RATE_PER_REQUEST.toFixed(2)}
                    </p>
                    <div className="mt-4 pt-4 border-t border-[#d1d9e0] space-y-2 text-sm" aria-label="billing-summary">
                      <div className="flex justify-between">
                        <span className="text-[#636c76]">Gross cost</span>
                        <span className="font-mono font-medium text-[#1f2328]">
                          ${aggregatedCosts.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#636c76]">Discounts</span>
                        <span className="font-mono font-medium text-[#1f2328]">
                          &minus;${aggregatedCosts.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 mt-2 border-t-2 border-[#d1d9e0]">
                        <span className="text-[#1f2328] font-bold">Net cost</span>
                        <span className="font-mono font-bold text-[#1f2328]">
                          ${aggregatedCosts.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Licenses */}
                  <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
                    <p className="text-xs font-bold text-[#636c76] uppercase tracking-wider text-center mb-3">Licenses</p>
                    <p className="text-3xl font-bold text-[#1f2328] text-center">
                      {analysis.totalUniqueUsers}
                    </p>
                    <p className="text-sm text-[#636c76] text-center mt-1">total users</p>
                    <div className="mt-4 pt-4 border-t border-[#d1d9e0] space-y-2 text-sm">
                      {analysis.quotaBreakdown.enterprise.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#636c76]">Copilot Enterprise</span>
                          <span className="font-mono font-medium text-[#1f2328]">{analysis.quotaBreakdown.enterprise.length}</span>
                        </div>
                      )}
                      {analysis.quotaBreakdown.business.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#636c76]">Copilot Business</span>
                          <span className="font-mono font-medium text-[#1f2328]">{analysis.quotaBreakdown.business.length}</span>
                        </div>
                      )}
                      {analysis.quotaBreakdown.unlimited.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#636c76]">Unlimited</span>
                          <span className="font-mono font-medium text-[#1f2328]">{analysis.quotaBreakdown.unlimited.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cost per Product */}
              {productCosts.length > 0 && costMetricsAvailable && (
                <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
                    <h3 className="text-lg font-semibold text-[#1f2328]">Cost per Product</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-[#d1d9e0]">
                          <th className="px-6 py-3 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Requests</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Gross</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Discount</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#d1d9e0]">
                        {productCosts.map((product) => (
                          <tr key={product.label} className="table-row-hover transition-colors duration-150">
                            <td className="px-6 py-3.5 text-sm font-medium text-[#1f2328]">{product.label}</td>
                            <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">{product.requests.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">${product.gross.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-sm text-emerald-600 text-right font-mono">-${product.discount.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-sm font-semibold text-[#1f2328] text-right font-mono">${product.net.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white border border-[#d1d9e0] rounded-md p-6 opacity-0 animate-scale-in" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-[#1f2328]">Requests by Model</h3>
                  <span className="text-xs text-[#636c76] font-medium">Total: {analysis.requestsByModel.reduce((sum, m) => sum + m.totalRequests, 0).toFixed(0)} requests</span>
                </div>
                <div className="h-72 xl:h-80 2xl:h-96">
                  <ModelRequestsBarChart data={chartData} />
                </div>
              </div>

              <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
                  <h3 className="text-lg font-semibold text-[#1f2328]">Model Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-[#d1d9e0]">
                        <th className="px-6 py-3 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">Model</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Requests</th>
                        {hasModelCosts && (
                          <>
                            <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Gross</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Discount</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Net</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d1d9e0]">
                      {modelRows.map((item, index) => {
                        return (
                          <tr key={index} className="table-row-hover transition-colors duration-150">
                            <td className="px-6 py-3.5 text-sm font-medium text-[#1f2328]">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getModelColor(item.model) }}></div>
                                {item.model}
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                              {item.requests.toFixed(2)}
                            </td>
                            {hasModelCosts && (
                              <>
                                <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                                  ${item.gross.toFixed(2)}
                                </td>
                                <td className="px-6 py-3.5 text-sm text-emerald-600 text-right font-mono">
                                  -${item.discount.toFixed(2)}
                                </td>
                                <td className="px-6 py-3.5 text-sm font-semibold text-[#1f2328] text-right font-mono">
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
          <div className="bg-white border border-[#d1d9e0] rounded-md p-5 sticky top-24 opacity-0 animate-slide-in-right" style={{ animationDelay: '250ms' }}>
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#636c76] uppercase tracking-wider">Summary</h3>

              <div className="flex items-center justify-between p-3 bg-[#f6f8fa] rounded-md border border-[#d1d9e0]">
                <span className="text-xs font-medium text-[#636c76]">Monthly Quota</span>
                <span className="text-sm font-bold text-[#1f2328]">
                  {analysis.quotaBreakdown.mixed
                    ? 'Mixed'
                    : planInfo[selectedPlan].monthlyQuota
                  }
                </span>
              </div>

              {analysis.quotaBreakdown.suggestedPlan && !analysis.quotaBreakdown.mixed && (
                <div className="badge-blue p-3 rounded-md">
                  <p className="text-xs">
                    Auto-selected <span className="font-semibold">{planInfo[analysis.quotaBreakdown.suggestedPlan].name}</span>
                  </p>
                </div>
              )}

              {/* Weekly Exhaustion Breakdown */}
              {weeklyExhaustion.weeks.length > 0 && (
                <div className="p-3 bg-[#f6f8fa] rounded-md border border-[#d1d9e0]">
                  <p className="text-xs font-semibold text-[#1f2328] mb-2">Weekly Exhaustion</p>
                  <p className="text-xs text-[#636c76] mb-3">Users exhausting quota by week</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-[#d1d9e0]">
                      <span className="font-semibold text-[#1f2328]">Total</span>
                      <span className="font-bold text-indigo-600">{weeklyExhaustion.totalUsersExhausted}</span>
                    </div>
                    {weeklyExhaustion.weeks.map(w => (
                      <div key={`${w.weekNumber}-${w.startDate}`} className="flex justify-between text-[#636c76]">
                        <span>Week {w.weekNumber}</span>
                        <span className="font-medium">{w.usersExhaustedInWeek}</span>
                      </div>
                    ))}
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
