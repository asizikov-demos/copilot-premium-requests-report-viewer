'use client';

import React from 'react';
import { ModelRequestsBarChart } from './charts/ModelRequestsBarChart';
import { ModelUsageTrendsOverview } from './ModelUsageTrendsOverview';
import { UsersOverview } from './UsersOverview';
import { PowerUsersOverview } from './PowerUsersOverview';
import { CodingAgentOverview } from './CodingAgentOverview';
import { InsightsOverview } from './InsightsOverview';
import { CostOptimizationInsights } from './CostOptimizationInsights';
import { PRICING } from '@/constants/pricing';
import { AnalysisProvider, useAnalysisContext } from '@/context/AnalysisContext';

interface DataAnalysisProps {
  ingestionResult: import('@/utils/ingestion').IngestionResult;
  filename: string;
  onReset: () => void;
}

type CopilotPlan = 'business' | 'enterprise';

function DataAnalysisInner() {
  const {
    selectedPlan,
    setSelectedPlan,
    view,
    setView,
    minRequestsThreshold,
    setMinRequestsThreshold,
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    powerUsersAnalysis,
    codingAgentAnalysis,
    processedData,
    weeklyExhaustion,
    availableMonths,
    hasMultipleMonthsData,
    selectedMonths,
    setSelectedMonths,
    isDetailViewActive,
    chartData,
    planInfo,
    filename,
    onReset,
    quotaArtifacts,
    usageArtifacts,
    billingArtifacts
  } = useAnalysisContext();

  // Aggregate cost metrics if present (new format only). We deliberately do NOT
  // derive pricing from raw request counts; instead we trust provided billing columns.
  // Prefer BillingAggregator artifacts; fallback to legacy scan only if absent
  // Determine cost metrics availability. Prefer BillingAggregator artifacts; fallback to legacy processedData scan for backward compatibility (tests / legacy path).
  let costMetricsAvailable = false;
  let aggregatedCosts: { net: number; gross: number; discount: number } | null = null;
  if (billingArtifacts?.hasAnyBillingData) {
    costMetricsAvailable = true;
    aggregatedCosts = billingArtifacts.totals;
  } else if (processedData.some(d => d.netAmount !== undefined || d.grossAmount !== undefined || d.discountAmount !== undefined)) {
    costMetricsAvailable = true;
    aggregatedCosts = processedData.reduce((acc, row) => {
      if (row.netAmount !== undefined) acc.net += row.netAmount;
      if (row.grossAmount !== undefined) acc.gross += row.grossAmount;
      if (row.discountAmount !== undefined) acc.discount += row.discountAmount;
      return acc;
    }, { net: 0, gross: 0, discount: 0 });
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Analysis Results</h2>
            <p className="text-sm text-zinc-500 mt-1">
              {analysis.timeFrame.start} — {analysis.timeFrame.end}
              <span className="mx-2 text-zinc-300">•</span>
              <span className="font-mono text-xs">{filename}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'users', label: `Users (${analysis.totalUniqueUsers})` },
            { key: 'codingAgent', label: `Agents (${codingAgentAnalysis.totalUsers})` },
            { key: 'powerUsers', label: `Power Users (${powerUsersAnalysis.powerUsers.length})` },
            { key: 'insights', label: 'Insights' },
            { key: 'costOptimization', label: 'Costs' },
            { key: 'modelTrends', label: 'Trends' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key as typeof view)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                view === item.key
                  ? 'bg-zinc-900 text-white' 
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Layout */}
      <div className={`${
        isDetailViewActive
          ? 'block' // Full width for users table
          : 'grid grid-cols-1 xl:grid-cols-4 2xl:grid-cols-5 gap-8'
      }`}>
        {/* Main Content */}
        <div className={`${
          isDetailViewActive
            ? 'w-full' 
            : 'xl:col-span-3 2xl:col-span-4 space-y-8'
        }`}>
          {view === 'users' ? (
            <div className="min-h-[80vh]">
              <UsersOverview 
                userData={userData}
                processedData={processedData}
                allModels={allModels}
                selectedPlan={selectedPlan}
                dailyCumulativeData={dailyCumulativeData}
                quotaArtifacts={quotaArtifacts}
                usageArtifacts={usageArtifacts}
                onBack={() => setView('overview')}
              />
            </div>
          ) : view === 'codingAgent' ? (
            <div className="min-h-[80vh]">
              <CodingAgentOverview 
                codingAgentUsers={codingAgentAnalysis.users}
                totalUniqueUsers={codingAgentAnalysis.totalUniqueUsers}
                adoptionRate={codingAgentAnalysis.adoptionRate}
                onBack={() => setView('overview')}
              />
            </div>
          ) : view === 'powerUsers' ? (
            <div className="min-h-[80vh]">
              <PowerUsersOverview 
                powerUsers={powerUsersAnalysis.powerUsers}
                totalQualifiedUsers={powerUsersAnalysis.totalQualifiedUsers}
                minRequestsThreshold={minRequestsThreshold}
                onBack={() => setView('overview')}
                onThresholdChange={setMinRequestsThreshold}
              />
            </div>
          ) : view === 'insights' ? (
            <div className="min-h-[80vh]">
              <InsightsOverview 
                userData={userData}
                processedData={processedData}
                onBack={() => setView('overview')}
              />
            </div>
          ) : view === 'costOptimization' ? (
            <div className="min-h-[80vh]">
              <CostOptimizationInsights 
                onBack={() => setView('overview')}
              />
            </div>
          ) : view === 'modelTrends' ? (
            <div className="min-h-[80vh]">
              <ModelUsageTrendsOverview />
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* Insights */}
                <button
                  onClick={() => setView('insights')}
                  className="group p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Insights</p>
                      <p className="mt-1 text-sm text-zinc-600">User consumption analysis</p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-300 group-hover:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Total Unique Users */}
                <button
                  onClick={() => setView('users')}
                  className="group p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Users</p>
                      <p className="mt-1 text-2xl font-semibold text-zinc-900">{analysis.totalUniqueUsers}</p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-300 group-hover:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Coding Agent Adoption */}
                <button
                  onClick={() => setView('codingAgent')}
                  className="group p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Agent Adoption</p>
                      <p className="mt-1 text-2xl font-semibold text-zinc-900">
                        {codingAgentAnalysis.adoptionRate.toFixed(0)}%
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {codingAgentAnalysis.totalUsers} of {codingAgentAnalysis.totalUniqueUsers} users
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-300 group-hover:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Power Users */}
                <button
                  onClick={() => setView('powerUsers')}
                  className="group p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Power Users</p>
                      <p className="mt-1 text-2xl font-semibold text-zinc-900">
                        {powerUsersAnalysis.powerUsers.length}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        of {powerUsersAnalysis.totalQualifiedUsers} qualified
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-300 group-hover:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Cost Optimization */}
                <button
                  onClick={() => setView('costOptimization')}
                  className="group p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Cost Optimization</p>
                      <p className="mt-1 text-sm text-zinc-600">SKU recommendations</p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-300 group-hover:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Model Usage Trends */}
                <button
                  onClick={() => setView('modelTrends')}
                  className="group p-5 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Usage Trends</p>
                      <p className="mt-1 text-sm text-zinc-600">Daily model breakdown</p>
                    </div>
                    <svg className="w-5 h-5 text-zinc-300 group-hover:text-zinc-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Chart */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6">
                <h3 className="text-sm font-medium text-zinc-900 mb-6">Requests by Model</h3>
                <div className="h-80 2xl:h-96">
                  <ModelRequestsBarChart data={chartData} />
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100">
                  <h3 className="text-sm font-medium text-zinc-900">Model Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Model
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Requests
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {analysis.requestsByModel.map((item, index) => (
                        <tr key={index} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-3 text-sm font-medium text-zinc-900">
                            {item.model}
                          </td>
                          <td className="px-6 py-3 text-sm text-zinc-600 text-right font-mono">
                            {item.totalRequests.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
            )}
        </div>

        {/* Info Panel - Hidden on mobile when showing users */}
        {!isDetailViewActive && (
          <div className="xl:col-span-1 2xl:col-span-1">
            <div className="bg-white border border-zinc-200 rounded-xl p-5 sticky top-24">
              {/* Plan Selector */}
              <div className="mb-6">
                <label htmlFor="plan-selector" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Plan Type
                </label>
                <select
                  id="plan-selector"
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value as CopilotPlan)}
                  className="block w-full px-3 py-2 text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="business">Copilot Business</option>
                  <option value="enterprise">Copilot Enterprise</option>
                </select>
              </div>

              {/* Billing Period Filter */}
              {hasMultipleMonthsData && (
                <div className="mb-6">
                  <label htmlFor="billing-period" className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
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
                    className="block w-full px-3 py-2 text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    size={Math.min(availableMonths.length, 4)}
                  >
                    {availableMonths.map(month => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Hold Ctrl/Cmd to select multiple
                  </p>
                </div>
              )}

              {/* Information Block */}
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Summary</h3>
                
                {/* Quota Breakdown */}
                {analysis.quotaBreakdown.mixed && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 mb-1.5">Mixed Licenses</p>
                    <div className="text-xs text-amber-700 space-y-0.5">
                      {analysis.quotaBreakdown.business.length > 0 && (
                        <p>Business ({PRICING.BUSINESS_QUOTA}): {analysis.quotaBreakdown.business.length}</p>
                      )}
                      {analysis.quotaBreakdown.enterprise.length > 0 && (
                        <p>Enterprise ({PRICING.ENTERPRISE_QUOTA}): {analysis.quotaBreakdown.enterprise.length}</p>
                      )}
                      {analysis.quotaBreakdown.unlimited.length > 0 && (
                        <p>Unlimited: {analysis.quotaBreakdown.unlimited.length}</p>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                  <span className="text-xs text-zinc-500">Monthly Quota</span>
                  <span className="text-sm font-medium text-zinc-900">
                    {analysis.quotaBreakdown.mixed 
                      ? 'Mixed'
                      : planInfo[selectedPlan].monthlyQuota
                    }
                  </span>
                </div>
                
                {analysis.quotaBreakdown.suggestedPlan && !analysis.quotaBreakdown.mixed && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-700">
                      Auto-selected {planInfo[analysis.quotaBreakdown.suggestedPlan].name}
                    </p>
                  </div>
                )}

                {/* Weekly Exhaustion Breakdown */}
                {weeklyExhaustion.weeks.length > 0 && (
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs font-medium text-zinc-700 mb-2">Weekly Exhaustion</p>
                    <p className="text-xs text-zinc-500 mb-2">Users exhausting quota by week</p>
                    <div className="space-y-1 text-xs text-zinc-600">
                      <p className="font-medium">Total: {weeklyExhaustion.totalUsersExhausted}</p>
                      {weeklyExhaustion.weeks.map(w => (
                        <p key={`${w.weekNumber}-${w.startDate}`}>
                          Week {w.weekNumber}: {w.usersExhaustedInWeek}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost Metrics (New Format) */}
                {costMetricsAvailable && aggregatedCosts && (
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs font-medium text-zinc-700 mb-2">Billing Summary</p>
                    <div className="space-y-1.5 text-xs" aria-label="billing-summary">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Gross</span>
                        <span className="font-mono text-zinc-900">${aggregatedCosts.gross.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Discounts</span>
                        <span className="font-mono text-zinc-900">-${aggregatedCosts.discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-zinc-200">
                        <span className="text-zinc-700 font-medium">Net</span>
                        <span className="font-mono font-medium text-zinc-900">${aggregatedCosts.net.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
