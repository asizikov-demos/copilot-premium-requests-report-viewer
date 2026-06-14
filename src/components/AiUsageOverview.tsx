'use client';

import { useMemo } from 'react';

import { useAnalysisContext } from '@/context/AnalysisContext';
import type { BillingUserTotals } from '@/utils/ingestion';
import { getEffectiveAicQuantity } from '@/utils/aicFields';

import { UsersAicDistributionChart } from './charts/UsersAicDistributionChart';

interface RankedAicUser {
  user: string;
  aiCredits: number;
  shareOfTotal: number;
}

interface AicConcentrationRow {
  concentration: string;
  users: number;
  shareOfAicCredits: number;
  aiCredits: number;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatAiCredits(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildRankedAicUsers(users: BillingUserTotals[]): RankedAicUser[] {
  const totalAiCredits = users.reduce((sum, user) => sum + getEffectiveAicQuantity(user), 0);

  return users
    .map((user) => {
      const aiCredits = getEffectiveAicQuantity(user);

      return {
        user: user.user,
        aiCredits,
        shareOfTotal: totalAiCredits > 0 ? (aiCredits / totalAiCredits) * 100 : 0,
      };
    })
    .filter((user) => user.aiCredits > 0)
    .sort((a, b) => b.aiCredits - a.aiCredits);
}

function summarizeTopUsers(
  concentration: string,
  rankedUsers: RankedAicUser[],
  requestedUserCount: number
): AicConcentrationRow {
  const users = rankedUsers.slice(0, Math.min(requestedUserCount, rankedUsers.length));
  const aiCredits = users.reduce((sum, user) => sum + user.aiCredits, 0);
  const shareOfAicCredits = users.reduce((sum, user) => sum + user.shareOfTotal, 0);

  return {
    concentration,
    users: users.length,
    shareOfAicCredits,
    aiCredits,
  };
}

function buildAicConcentrationRows(rankedUsers: RankedAicUser[]): AicConcentrationRow[] {
  if (rankedUsers.length === 0) {
    return [];
  }

  const topTenPercentUserCount = Math.max(1, Math.ceil(rankedUsers.length * 0.1));

  return [
    summarizeTopUsers('Top user', rankedUsers, 1),
    summarizeTopUsers('Top 5 users', rankedUsers, 5),
    summarizeTopUsers('Top 10%', rankedUsers, topTenPercentUserCount),
  ];
}

export function AiUsageOverview() {
  const { billingArtifacts } = useAnalysisContext();
  const rankedUsers = useMemo(
    () => buildRankedAicUsers(billingArtifacts?.users ?? []),
    [billingArtifacts?.users]
  );
  const concentrationRows = useMemo(
    () => buildAicConcentrationRows(rankedUsers),
    [rankedUsers]
  );
  const topSpendDriverUsers = useMemo(
    () => rankedUsers.slice(0, 10),
    [rankedUsers]
  );

  if (!billingArtifacts?.hasAnyAicData) {
    return (
      <div className="w-full space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">AI Usage</h2>
          <p className="text-sm text-[#636c76] mt-1">
            AI Credits data is not available for the selected report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">AI Usage</h2>
        <p className="text-sm text-[#636c76] mt-1">
          AI Credits consumption patterns across users, including credit volume and gross usage.
        </p>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">AI Credits Group Heatmap</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Consumption groups compared by user population and AI Credits concentration
          </p>
        </div>
        <div className="p-5">
          <UsersAicDistributionChart users={billingArtifacts.users} />
        </div>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">AI Credits Concentration</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Share of consumed AI Credits concentrated among the highest-consuming users
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full" aria-label="AI Credits concentration by top user groups">
            <thead>
              <tr className="border-b border-[#d1d9e0]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  Concentration
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  Users
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  Share of AI Credits
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  AI Credits
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d1d9e0]">
              {concentrationRows.length > 0 ? (
                concentrationRows.map((row) => (
                  <tr key={row.concentration} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                      {row.concentration}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                      {row.users.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                      {formatPercentage(row.shareOfAicCredits)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums font-semibold text-[#1f2328] text-right">
                      {formatAiCredits(row.aiCredits)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-[#636c76]">
                    No AI Credits consumption is available for the current users
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">Top Spend Drivers</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Top 10 users ranked by AI Credits consumption
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full" aria-label="Users ranked by AI Credits consumption">
            <thead>
              <tr className="border-b border-[#d1d9e0]">
                <th className="w-16 px-4 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  Rank
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  Username
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  AI Credits
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d1d9e0]">
              {topSpendDriverUsers.length > 0 ? (
                topSpendDriverUsers.map((user, index) => (
                  <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="w-16 px-4 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-left">
                      {index + 1}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                      {user.user}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums font-semibold text-[#1f2328] text-right">
                      {formatAiCredits(user.aiCredits)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                      {formatPercentage(user.shareOfTotal)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-[#636c76]">
                    No AI Credits consumption is available for the current users
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
