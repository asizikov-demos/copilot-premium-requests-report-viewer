"use client";

import React, { useMemo } from 'react';

import { PRICING } from '@/constants/pricing';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { computeCostOptimizationFromArtifacts } from '@/utils/analytics/costOptimization';
import { formatCurrency } from '@/utils/formatters';

export function CostOptimizationInsights() {
  const { usageArtifacts, quotaArtifacts, billingArtifacts, dailyBucketsArtifacts, selectedMonths } = useAnalysisContext();

  const summary = useMemo(() => {
    if (!usageArtifacts || !quotaArtifacts || !billingArtifacts) return null;

    const dailyTotals = dailyBucketsArtifacts?.dailyUserTotals;
    const months = dailyBucketsArtifacts?.months
      ?? Array.from(new Set(Array.from(dailyTotals?.keys() ?? [], date => date.slice(0, 7))));
    if (selectedMonths.length > 1 || (selectedMonths.length === 0 && months.length > 1)) return null;

    return computeCostOptimizationFromArtifacts(usageArtifacts, quotaArtifacts, billingArtifacts);
  }, [usageArtifacts, quotaArtifacts, billingArtifacts, dailyBucketsArtifacts, selectedMonths]);

  if (!summary) {
    return (
      <div className="min-h-[60vh] flex flex-col">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Cost Monitoring</h2>
          <p className="text-sm text-[#636c76] mt-1">AI Credits usage and billed net charges</p>
        </div>
        <div className="p-6 mt-8 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
          <p className="text-sm text-[#636c76]">
            <span className="font-semibold text-[#1f2328]">Cost monitoring unavailable.</span>{' '}
            This view requires Business AI Credits usage, quota, and user-level billed net charges.
            Select one billing month when the report covers multiple months; usage and billing must cover that same period.
          </p>
        </div>
      </div>
    );
  }

  const { overQuotaUsers, nearQuotaUsers, totalOverQuotaUsers, totalBilledNetCharge, totalExcessCredits, missingBillingUsers } = summary;

  return (
    <div className="min-h-[60vh] flex flex-col space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Cost Monitoring</h2>
        <p className="text-sm text-[#636c76] mt-1">AI Credits usage and billed net charges for Copilot Business users</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">Users above included AI Credits</p>
          <p className="text-2xl font-bold tabular-nums text-[#1f2328] mt-2">{totalOverQuotaUsers}</p>
          <p className="text-xs text-[#636c76] mt-1">Business quota: {PRICING.BUSINESS_AI_CREDIT_QUOTA.toLocaleString()} AI Credits</p>
        </div>
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">Billed net for users above quota</p>
          <p className="text-2xl font-bold tabular-nums text-[#cf222e] mt-2">{formatCurrency(totalBilledNetCharge)}</p>
          <p className="text-xs text-[#636c76] mt-1">Actual user-level net charges in the report</p>
        </div>
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">AI Credits above quota</p>
          <p className="text-2xl font-bold tabular-nums text-[#1f2328] mt-2">{totalExcessCredits.toLocaleString()}</p>
          <p className="text-xs text-[#636c76] mt-1">Observed usage, not estimated charges</p>
        </div>
        <div className="bg-white border border-[#d1d9e0] p-5 rounded-md">
          <p className="text-xs font-semibold text-[#636c76] uppercase tracking-[0.05em]">Business users near quota</p>
          <p className="text-2xl font-bold tabular-nums text-[#d97706] mt-2">{nearQuotaUsers.length}</p>
          <p className="text-xs text-[#636c76] mt-1">At least 80% of included AI Credits</p>
        </div>
      </div>

      <div className="p-5 bg-[#eef2ff] border border-[#c7d2fe] rounded-md">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-[#6366f1] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3L13.73 3.8a2 2 0 00-3.46 0L3.2 16a2 2 0 001.73 3z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#1f2328]">Review usage and budgets</p>
            <p className="text-sm text-[#1f2328] mt-1">
              Prioritize users with the highest billed net charges, inspect their model usage and discounts, and review budget alerts or limits before the next billing period. Net charges may include items beyond AI Credits above quota; this view does not attribute a specific amount to excess credits.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden flex-1">
        <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
          <h3 className="text-lg font-semibold text-[#1f2328]">Business users above quota</h3>
          <p className="text-sm text-[#636c76] mt-1">
            Ranked by actual billed net charge. Only users with reported billed net amounts are included.
          </p>
        </div>
        {overQuotaUsers.length === 0 ? (
          <div className="p-6 text-sm text-[#636c76]">No billed Business users exceeded their AI Credits quota in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">User</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Total AI Credits</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Excess AI Credits</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Billed Net Charge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {overQuotaUsers.map(user => (
                  <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1f2328]">{user.user}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">{user.totalCredits.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">{user.excessCredits.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-[#cf222e] text-right">{formatCurrency(user.billedNetCharge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nearQuotaUsers.length > 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#fffbeb]">
            <h3 className="text-lg font-semibold text-[#1f2328]">Business users near quota</h3>
            <p className="text-sm text-[#636c76] mt-1">At least 80% of included AI Credits used, but not above quota.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">User</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Total AI Credits</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Billed Net Charge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {nearQuotaUsers.map(user => (
                  <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1f2328]">{user.user}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">{user.totalCredits.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">{formatCurrency(user.billedNetCharge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="p-4 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
        <p className="text-xs text-[#636c76]">
          <span className="font-semibold text-[#1f2328]">Note for administrators:</span>{' '}
          {missingBillingUsers > 0 && `${missingBillingUsers} Business user(s) without billed net data are excluded. `}
          Net amounts are taken from billing data, not calculated from AI Credits. Usage and billing must cover the same selected period; without period-scoped data this view is unavailable.
        </p>
      </div>
    </div>
  );
}
