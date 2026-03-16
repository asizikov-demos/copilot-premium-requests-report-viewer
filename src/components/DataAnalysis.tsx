'use client';

import React from 'react';
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

function DataAnalysisInner() {
  const {
    selectedPlan,
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
      <div className="mb-8 animate-fade-in-up">
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
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'users', label: `Users (${analysis.totalUniqueUsers})` },
            { key: 'codingAgent', label: `Agents (${codingAgentAnalysis.totalUsers})` },
            { key: 'insights', label: 'Insights' },
            { key: 'costOptimization', label: 'Costs' },
            { key: 'modelTrends', label: 'Trends' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key as typeof view)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                view === item.key
                  ? 'bg-stone-900 text-white shadow-md' 
                  : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 hover:border-stone-300'
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
          : 'grid grid-cols-1 xl:grid-cols-5 2xl:grid-cols-6 gap-6'
      }`}>
        {/* Main Content */}
        <div className={`${
          isDetailViewActive
            ? 'w-full' 
            : 'xl:col-span-4 2xl:col-span-5 space-y-6'
        }`}>
          {view === 'users' ? (
            <div className="min-h-[80vh]">
              <UsersOverview 
                userData={userData}
                processedData={processedData}
                allModels={allModels}
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
                codeReviewAnalysis={codeReviewAnalysis}
                onBack={() => setView('overview')}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
                {/* Insights */}
                <button
                  onClick={() => setView('insights')}
                  className="group stat-card card-elevated p-5 rounded-xl text-left opacity-0 animate-fade-in-up delay-1"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Insights</p>
                      </div>
                      <p className="text-sm font-medium text-stone-700">User consumption analysis</p>
                    </div>
                    <svg className="w-5 h-5 text-stone-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Total Unique Users */}
                <button
                  onClick={() => setView('users')}
                  className="group stat-card card-elevated p-5 rounded-xl text-left opacity-0 animate-fade-in-up delay-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Users</p>
                      </div>
                      <p className="text-2xl font-bold text-stone-900">{analysis.totalUniqueUsers}</p>
                    </div>
                    <svg className="w-5 h-5 text-stone-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Agents Adoption */}
                <button
                  onClick={() => setView('codingAgent')}
                  className="group stat-card card-elevated p-5 rounded-xl text-left opacity-0 animate-fade-in-up delay-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Agents Adoption</p>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <p className="text-2xl font-bold text-stone-900">{codingAgentAnalysis.adoptionRate.toFixed(0)}% <span className="text-xs font-medium text-stone-500">CCA</span></p>
                        <p className="text-2xl font-bold text-stone-900">{codeReviewAnalysis.adoptionRate.toFixed(0)}% <span className="text-xs font-medium text-stone-500">CCR</span></p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-stone-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Cost Optimization */}
                <button
                  onClick={() => setView('costOptimization')}
                  className="group stat-card card-elevated p-5 rounded-xl text-left opacity-0 animate-fade-in-up delay-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Cost Optimization</p>
                      </div>
                      <p className="text-sm font-medium text-stone-700">SKU recommendations</p>
                    </div>
                    <svg className="w-5 h-5 text-stone-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Model Usage Trends */}
                <button
                  onClick={() => setView('modelTrends')}
                  className="group stat-card card-elevated p-5 rounded-xl text-left opacity-0 animate-fade-in-up delay-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Usage Trends</p>
                      </div>
                      <p className="text-sm font-medium text-stone-700">Daily model breakdown</p>
                    </div>
                    <svg className="w-5 h-5 text-stone-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Chart */}
              <div className="card-elevated rounded-2xl p-6 opacity-0 animate-scale-in" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-stone-900">Requests by Model</h3>
                  <span className="text-xs text-stone-400 font-medium">Total: {analysis.requestsByModel.reduce((sum, m) => sum + m.totalRequests, 0).toFixed(0)} requests</span>
                </div>
                <div className="h-72 xl:h-80 2xl:h-96">
                  <ModelRequestsBarChart data={chartData} />
                </div>
              </div>

              {/* Data Table */}
              <div className="card-elevated rounded-2xl overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-transparent">
                  <h3 className="text-lg font-semibold text-stone-900">Model Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                          Model
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                          Requests
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {analysis.requestsByModel.map((item, index) => (
                        <tr key={index} className="table-row-hover transition-colors">
                          <td className="px-6 py-3.5 text-sm font-medium text-stone-900">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getModelColor(item.model) }}></div>
                              {item.model}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-stone-600 text-right font-mono">
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
            <div className="glass-panel rounded-2xl p-5 sticky top-24 opacity-0 animate-slide-in-right" style={{ animationDelay: '250ms' }}>
              {/* Billing Period Filter */}
              {hasMultipleMonthsData && (
                <div className="mb-5">
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

              {/* Information Block */}
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

                {/* Cost Metrics (New Format) */}
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
