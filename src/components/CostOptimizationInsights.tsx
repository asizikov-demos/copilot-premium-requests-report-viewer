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
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Cost Optimization</h2>
          <button
            onClick={onBack}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            ← Back
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          Cost optimization insights unavailable — quota or usage data could not be derived.
        </p>
      </div>
    );
  }

  const { candidates, totalCandidates, totalOverageCost, estimatedEnterpriseCost, totalPotentialSavings, approachingBreakEven } = summary;

  return (
    <div className="min-h-[60vh] flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Cost Optimization</h2>
          <p className="text-sm text-zinc-500 mt-1">Enterprise upgrade recommendations</p>
        </div>
        <button
          onClick={onBack}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-zinc-200 rounded-xl">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Candidates</p>
          <p className="text-2xl font-semibold text-zinc-900 mt-1">{totalCandidates}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Business users {COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD}+ over quota
          </p>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-xl">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Overage Cost</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">${totalOverageCost.toFixed(0)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Current Business overage</p>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-xl">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Upgrade Cost</p>
          <p className="text-2xl font-semibold text-zinc-900 mt-1">${estimatedEnterpriseCost.toFixed(0)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Enterprise for candidates</p>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-xl">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Savings</p>
          <p className="text-2xl font-semibold text-emerald-600 mt-1">${totalPotentialSavings.toFixed(0)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Potential monthly</p>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
        <p className="text-sm text-emerald-800">
          Upgrading high-consumption Business users to Enterprise can reduce overage spend. 
          Estimated monthly savings: <span className="font-semibold">${totalPotentialSavings.toFixed(2)}</span>
        </p>
      </div>

      {/* Candidates Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden flex-1">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-medium text-zinc-900">Recommended for Enterprise</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Business users exceeding {PRICING.BUSINESS_QUOTA} quota by {COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD}+ requests
          </p>
        </div>
        {candidates.length === 0 ? (
          <div className="p-5">
            <p className="text-sm text-zinc-500">
              No users currently meet the threshold for Enterprise upgrade recommendations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    User
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Requests
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Overage
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Cost
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Savings
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {candidates.map(candidate => (
                  <tr key={candidate.user} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {candidate.user}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-600 text-right">
                      {candidate.totalRequests.toFixed(0)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-600 text-right">
                      +{candidate.overageRequests.toFixed(0)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-red-600 text-right">
                      ${candidate.overageCost.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-emerald-600 text-right">
                      ${candidate.potentialSavings.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {approachingBreakEven.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h3 className="text-sm font-medium text-zinc-900">Approaching Break-Even</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Users within reach of Enterprise cost-neutrality
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    User
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Requests
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Overage
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {approachingBreakEven.map(user => (
                  <tr key={user.user} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{user.user}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-600 text-right">
                      {user.totalRequests.toFixed(0)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-600 text-right">
                      +{user.overageRequests.toFixed(0)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-600 text-right">
                      ${user.overageCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
