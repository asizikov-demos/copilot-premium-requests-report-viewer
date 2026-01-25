"use client";

import React, { useMemo } from 'react';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { computeCostOptimizationFromArtifacts } from '@/utils/analytics/costOptimization';
import { PRICING, COST_OPTIMIZATION_THRESHOLDS } from '@/constants/pricing';

interface CostOptimizationInsightsProps {
  onBack: () => void;
}

export function CostOptimizationInsights({ onBack }: CostOptimizationInsightsProps) {
  const { usageArtifacts, quotaArtifacts } = useAnalysisContext();

  const summary = useMemo(() => {
    if (!usageArtifacts || !quotaArtifacts) {
      return null;
    }
    return computeCostOptimizationFromArtifacts(usageArtifacts, quotaArtifacts);
  }, [usageArtifacts, quotaArtifacts]);

  if (!summary) {
    return (
      <div className="min-h-[60vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="display-heading text-3xl text-stone-900">Cost Optimization</h2>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
            Back to Overview
          </button>
        </div>
        <div className="p-6 bg-stone-50 border border-stone-200 rounded-xl">
          <p className="text-sm text-stone-600">
            <span className="font-semibold text-stone-900">Cost optimization insights unavailable.</span>{' '}
            This analysis requires quota and usage data that could not be derived from the uploaded report. 
            Ensure your CSV includes user quota information.
          </p>
        </div>
      </div>
    );
  }

  const { candidates, totalCandidates, totalOverageCost, estimatedEnterpriseCost, totalPotentialSavings, approachingBreakEven } = summary;

  return (
    <div className="min-h-[60vh] flex flex-col space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-heading text-3xl text-stone-900">Cost Optimization</h2>
          <p className="text-sm text-stone-500 mt-1">SKU upgrade analysis for reducing overage spend</p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
          Back to Overview
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-elevated p-5 rounded-xl">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Business users exceeding quota by {COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD}+ requests</p>
          <p className="text-3xl font-bold text-stone-900 mt-2">{totalCandidates}</p>
          <p className="text-xs text-stone-400 mt-1">
            Users on Copilot Business ({PRICING.BUSINESS_QUOTA} RPU) with substantial overage
          </p>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Current overage cost (Business)</p>
          <p className="text-3xl font-bold text-red-600 mt-2">${totalOverageCost.toFixed(2)}</p>
          <p className="text-xs text-stone-400 mt-1">
            Calculated using per-request overage rate from billing
          </p>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Estimated upgrade cost (GitHub Copilot Enterprise)</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">${estimatedEnterpriseCost.toFixed(2)}</p>
          <p className="text-xs text-stone-400 mt-1">
            Approximate cost for granting GitHub Copilot Enterprise quota ({PRICING.ENTERPRISE_QUOTA} RPU) to all candidates
          </p>
        </div>
        <div className="card-elevated p-5 rounded-xl">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Estimated savings after upgrade</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">${totalPotentialSavings.toFixed(2)}</p>
          <p className="text-xs text-stone-400 mt-1">
            Difference between current Business overage spend and GitHub Copilot Enterprise uplift for recommended users
          </p>
        </div>
      </div>

      {/* Summary Callout */}
      <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-emerald-900">Cost savings opportunity with GitHub Copilot Enterprise</p>
            <p className="text-sm text-emerald-800 mt-1">
              Upgrading high-consumption Copilot Business users to GitHub Copilot Enterprise can reduce overage spend by replacing per-request charges with a higher included monthly quota. Based on current data, the estimated potential monthly savings is <span className="font-bold">${totalPotentialSavings.toFixed(2)}</span> for the identified users.
            </p>
            <p className="text-xs text-emerald-600 mt-2 italic">
              This analysis uses the configured overage rate per request and a fixed monthly Enterprise uplift per user. It does not replace your billing system of record.
            </p>
          </div>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="card-elevated rounded-xl overflow-hidden flex-1">
        <div className="px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-transparent">
          <h3 className="text-lg font-semibold text-stone-900">Users recommended for Enterprise upgrade</h3>
          <p className="text-sm text-stone-500 mt-1">
            These users are on Copilot Business and exceed their included {PRICING.BUSINESS_QUOTA} premium requests by at least {COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD} in the selected billing period.
          </p>
        </div>
        {candidates.length === 0 ? (
          <div className="p-6">
            <div className="flex items-center gap-3 text-stone-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">
                No users currently meet the threshold for Enterprise upgrade recommendations. Your Business users are within their included quota allowance.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Plan / Quota
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Overage Requests
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Overage Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Enterprise Capacity
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Potential Savings
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {candidates.map(candidate => (
                  <tr key={candidate.user} className="table-row-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">
                      {candidate.user}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      Copilot Business ({PRICING.BUSINESS_QUOTA})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-stone-600 text-right">
                      {candidate.totalRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-stone-600 text-right">
                      {candidate.overageRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-stone-600 text-right">
                      ${candidate.overageCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      {PRICING.ENTERPRISE_QUOTA} included ({PRICING.ENTERPRISE_QUOTA - PRICING.BUSINESS_QUOTA} extra over Business)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-emerald-600 text-right">
                      ${candidate.potentialSavings.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approaching Break-Even */}
      {approachingBreakEven.length > 0 && (
        <div className="card-elevated rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-amber-50 to-transparent">
            <h3 className="text-lg font-semibold text-stone-900">Users approaching Enterprise break-even</h3>
            <p className="text-sm text-stone-500 mt-1">
              These Copilot Business users are within roughly {COST_OPTIMIZATION_THRESHOLDS.APPROACHING_THRESHOLD} premium requests of the break-even point where GitHub Copilot Enterprise becomes cost-neutral or cheaper based on overage spend.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="px-6 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    User
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Overage Requests
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider bg-stone-50">
                    Current Overage Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {approachingBreakEven.map(user => (
                  <tr key={user.user} className="table-row-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-stone-900">{user.user}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-stone-600 text-right">
                      {user.totalRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-stone-600 text-right">
                      {user.overageRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-stone-600 text-right">
                      ${user.overageCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
        <p className="text-xs text-stone-500">
          <span className="font-semibold text-stone-700">Note for administrators:</span>{' '}
          These recommendations are based on the premium request usage patterns observed in the uploaded billing report. Actual savings will depend on future usage patterns, which may vary. Consider monitoring users over multiple billing cycles before making SKU changes. Enterprise licenses also include additional features beyond increased quota that may provide additional value.
        </p>
      </div>
    </div>
  );
}
