"use client";

import React, { useMemo } from 'react';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { computeCostOptimisationFromArtifacts } from '@/utils/analytics/costOptimisation';
import { PRICING } from '@/constants/pricing';

interface CostOptimisationInsightsProps {
  onBack: () => void;
}

export function CostOptimisationInsights({ onBack }: CostOptimisationInsightsProps) {
  const { usageArtifacts, quotaArtifacts } = useAnalysisContext();

  const summary = useMemo(() => {
    if (!usageArtifacts || !quotaArtifacts) {
      return null;
    }
    return computeCostOptimisationFromArtifacts(usageArtifacts, quotaArtifacts);
  }, [usageArtifacts, quotaArtifacts]);

  if (!summary) {
    return (
      <div className="min-h-[60vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Cost Optimisation</h2>
          <button
            onClick={onBack}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <span className="mr-1" aria-hidden="true">←</span>
            <span>Back to Overview</span>
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Cost optimisation insights are unavailable because quota or usage artifacts could not be derived from the CSV.
        </p>
      </div>
    );
  }

  const { candidates, totalCandidates, totalOverageCost, estimatedEnterpriseCost, totalPotentialSavings, approachingBreakEven } = summary;

  return (
    <div className="min-h-[60vh] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Cost Optimisation</h2>
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <span className="mr-1" aria-hidden="true">←</span>
          <span>Back to Overview</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Business users exceeding quota by 500+ requests</h3>
          <p className="text-2xl font-semibold text-blue-600">{totalCandidates}</p>
          <p className="mt-1 text-xs text-gray-500">
            Users on Copilot Business ({PRICING.BUSINESS_QUOTA} RPU) with substantial overage.
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Current overage cost (Business)</h3>
          <p className="text-2xl font-semibold text-rose-600">${totalOverageCost.toFixed(2)}</p>
          <p className="mt-1 text-xs text-gray-500">Calculated using per-request overage rate from billing.</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Estimated upgrade cost (GitHub Copilot Enterprise)</h3>
          <p className="text-2xl font-semibold text-emerald-600">${estimatedEnterpriseCost.toFixed(2)}</p>
          <p className="mt-1 text-xs text-gray-500">
            Approximate cost for granting GitHub Copilot Enterprise quota ({PRICING.ENTERPRISE_QUOTA} RPU) to all candidates.
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Estimated savings after upgrade</h3>
          <p className="text-2xl font-semibold text-emerald-700">${totalPotentialSavings.toFixed(2)}</p>
          <p className="mt-1 text-xs text-gray-500">
            Difference between current Business overage spend and GitHub Copilot Enterprise uplift for recommended users.
          </p>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-emerald-800 mb-1">Cost savings opportunity with GitHub Copilot Enterprise</h3>
        <p className="text-sm text-emerald-900">
          Upgrading high-consumption Copilot Business users to GitHub Copilot Enterprise can reduce overage spend by replacing
          per-request charges with a higher included monthly quota. Based on current data, the estimated potential
          monthly savings is <span className="font-semibold">${totalPotentialSavings.toFixed(2)}</span> for the
          identified users.
        </p>
        <p className="mt-2 text-xs text-emerald-800">
          This analysis uses the configured overage rate per request and a fixed monthly Enterprise uplift per user.
          It does not replace your billing system of record.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden flex-1">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Users recommended for Enterprise upgrade</h3>
            <p className="mt-1 text-sm text-gray-600">
              These users are on Copilot Business and exceed their included {PRICING.BUSINESS_QUOTA} premium requests by
              at least 500 in the selected billing period.
            </p>
          </div>
        </div>
        {candidates.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-gray-600">
              No Copilot Business users currently exceed their monthly quota by 500 or more requests. No Enterprise
              upgrade recommendations at this time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan / Quota
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overage Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overage Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enterprise Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Potential Savings
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidates.map(candidate => (
                  <tr key={candidate.user}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {candidate.user}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Copilot Business ({candidate.quota})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidate.totalRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidate.overageRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${candidate.overageCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidate.enterpriseQuota} included ({candidate.enterpriseExtraCapacity} extra over Business)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600">
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
        <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Users approaching Enterprise break-even</h3>
            <p className="mt-1 text-sm text-gray-600">
              These Copilot Business users are within roughly 100 premium requests of the break-even point where GitHub
              Copilot Enterprise becomes cost-neutral or cheaper based on overage spend.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overage Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Overage Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {approachingBreakEven.map(user => (
                  <tr key={user.user}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.user}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.totalRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.overageRequests.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
