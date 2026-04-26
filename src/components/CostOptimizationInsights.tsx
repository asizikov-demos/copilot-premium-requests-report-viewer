"use client";

import React, { useMemo } from 'react';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { computeCostOptimizationFromArtifacts } from '@/utils/analytics/costOptimization';
import { PRICING, COST_OPTIMIZATION_THRESHOLDS } from '@/constants/pricing';

export function CostOptimizationInsights() {
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Cost Optimization</h2>
            <p className="text-sm text-[#636c76] mt-1">SKU upgrade analysis for reducing overage spend</p>
          </div>
        </div>
        <div className="p-6 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
          <p className="text-sm text-[#636c76]">
            <span className="font-semibold text-[#1f2328]">Cost optimization insights unavailable.</span>{' '}
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
          <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Cost Optimization</h2>
          <p className="text-sm text-[#636c76] mt-1">SKU upgrade analysis for reducing overage spend</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">Business users exceeding quota by {COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD}+ requests</p>
          <p className="text-2xl font-bold tabular-nums text-[#1f2328] mt-2">{totalCandidates}</p>
          <p className="text-xs text-[#636c76] mt-1">
            Users on Copilot Business ({PRICING.BUSINESS_QUOTA} RPU) with substantial overage
          </p>
        </div>
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">Current overage cost (Business)</p>
          <p className="text-2xl font-bold tabular-nums text-[#cf222e] mt-2">${totalOverageCost.toFixed(2)}</p>
          <p className="text-xs text-[#636c76] mt-1">
            Calculated using per-request overage rate from billing
          </p>
        </div>
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">Estimated upgrade cost (GitHub Copilot Enterprise)</p>
          <p className="text-2xl font-bold tabular-nums text-[#d97706] mt-2">${estimatedEnterpriseCost.toFixed(2)}</p>
          <p className="text-xs text-[#636c76] mt-1">
            Approximate cost for granting GitHub Copilot Enterprise quota ({PRICING.ENTERPRISE_QUOTA} RPU) to all candidates
          </p>
        </div>
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">Estimated savings after upgrade</p>
          <p className="text-2xl font-bold tabular-nums text-[#2da44e] mt-2">${totalPotentialSavings.toFixed(2)}</p>
          <p className="text-xs text-[#636c76] mt-1">
            Difference between current Business overage spend and GitHub Copilot Enterprise uplift for recommended users
          </p>
        </div>
      </div>

      {/* Summary Callout */}
      <div className="p-5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-md">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-[#2da44e] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#2da44e]">Cost savings opportunity with GitHub Copilot Enterprise</p>
            <p className="text-sm text-[#1f2328] mt-1">
              Upgrading high-consumption Copilot Business users to GitHub Copilot Enterprise can reduce overage spend by replacing per-request charges with a higher included monthly quota. Based on current data, the estimated potential monthly savings is <span className="font-bold">${totalPotentialSavings.toFixed(2)}</span> for the identified users.
            </p>
            <p className="text-xs text-[#2da44e] mt-2 italic">
              This analysis uses the configured overage rate per request and a fixed monthly Enterprise uplift per user. It does not replace your billing system of record.
            </p>
          </div>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden flex-1">
        <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
          <h3 className="text-lg font-semibold text-[#1f2328]">Users recommended for Enterprise upgrade</h3>
          <p className="text-sm text-[#636c76] mt-1">
            These users are on Copilot Business and exceed their included {PRICING.BUSINESS_QUOTA} premium requests by at least {COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD} in the selected billing period.
          </p>
        </div>
        {candidates.length === 0 ? (
          <div className="p-6">
            <div className="flex items-center gap-3 text-[#636c76]">
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
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Plan / Quota
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Overage Requests
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Overage Cost
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Enterprise Capacity
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Potential Savings
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {candidates.map(candidate => (
                  <tr key={candidate.user} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                      {candidate.user}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#636c76]">
                      Copilot Business ({PRICING.BUSINESS_QUOTA})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
                      {candidate.totalRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
                      {candidate.overageRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
                      ${candidate.overageCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#636c76]">
                      {PRICING.ENTERPRISE_QUOTA} included ({PRICING.ENTERPRISE_QUOTA - PRICING.BUSINESS_QUOTA} extra over Business)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-[#2da44e] text-right">
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
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#fffbeb]">
            <h3 className="text-lg font-semibold text-[#1f2328]">Users approaching Enterprise break-even</h3>
            <p className="text-sm text-[#636c76] mt-1">
              These Copilot Business users are within roughly {COST_OPTIMIZATION_THRESHOLDS.APPROACHING_BREAKEVEN_THRESHOLD} premium requests of the break-even point where GitHub Copilot Enterprise becomes cost-neutral or cheaper based on overage spend.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    User
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Overage Requests
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Current Overage Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {approachingBreakEven.map(user => (
                  <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1f2328]">{user.user}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
                      {user.totalRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
                      {user.overageRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
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
      <div className="p-4 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
        <p className="text-xs text-[#636c76]">
          <span className="font-semibold text-[#1f2328]">Note for administrators:</span>{' '}
          These recommendations are based on the premium request usage patterns observed in the uploaded billing report. Actual savings will depend on future usage patterns, which may vary. Consider monitoring users over multiple billing cycles before making SKU changes. Enterprise licenses also include additional features beyond increased quota that may provide additional value.
        </p>
      </div>
    </div>
  );
}
