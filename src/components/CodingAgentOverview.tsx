'use client';

import React, { useState, useMemo } from 'react';
import { CodingAgentUsageChart } from './charts/CodingAgentUsageChart';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { DailyBucketsArtifacts, buildDailyCodingAgentUsageFromArtifacts, buildDailyCodeReviewUsageFromArtifacts } from '@/utils/ingestion';
import type { CodeReviewAnalysis } from '@/types/csv';

interface CodingAgentOverviewProps {
  codingAgentUsers: import('@/types/csv').CodingAgentUser[];
  totalUniqueUsers: number;
  adoptionRate: number;
  codeReviewAnalysis: CodeReviewAnalysis;
}

export function CodingAgentOverview({ 
  codingAgentUsers, 
  totalUniqueUsers,
  adoptionRate,
  codeReviewAnalysis
}: CodingAgentOverviewProps) {
  const isMobile = useIsMobile();
  const [showChart, setShowChart] = useState(true);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showAllReviewUsers, setShowAllReviewUsers] = useState(false);
  const { dailyBucketsArtifacts, selectedMonths } = useAnalysisContext();
  const typedDailyBuckets = dailyBucketsArtifacts as DailyBucketsArtifacts | undefined;
  
  // Memoize daily coding agent data, filtered by selected billing months
  const dailyCodingAgentData = useMemo(() => {
    if (typedDailyBuckets?.dailyUserModelTotals) {
      const raw = buildDailyCodingAgentUsageFromArtifacts(typedDailyBuckets);
      return selectedMonths.length === 0
        ? raw
        : raw.filter(d => selectedMonths.includes(d.date.slice(0, 7)));
    }
    return [];
  }, [typedDailyBuckets, selectedMonths]);

  const dailyCodeReviewData = useMemo(() => {
    if (typedDailyBuckets?.dailyUserModelTotals) {
      const raw = buildDailyCodeReviewUsageFromArtifacts(typedDailyBuckets);
      return selectedMonths.length === 0
        ? raw
        : raw.filter(d => selectedMonths.includes(d.date.slice(0, 7)));
    }
    return [];
  }, [typedDailyBuckets, selectedMonths]);

  const TABLE_PREVIEW_COUNT = 5;
  const visibleUsers = showAllUsers ? codingAgentUsers : codingAgentUsers.slice(0, TABLE_PREVIEW_COUNT);
  const hasMore = codingAgentUsers.length > TABLE_PREVIEW_COUNT;

  const visibleReviewUsers = useMemo(() => {
    if (showAllReviewUsers) {
      return codeReviewAnalysis.users;
    }

    const preview = codeReviewAnalysis.users.slice(0, TABLE_PREVIEW_COUNT);
    const syntheticRow = codeReviewAnalysis.users.find((user) => user.isSyntheticNonCopilotRow);

    if (!syntheticRow || preview.some((user) => user.isSyntheticNonCopilotRow)) {
      return preview;
    }

    return [...preview.slice(0, Math.max(0, TABLE_PREVIEW_COUNT - 1)), syntheticRow];
  }, [codeReviewAnalysis.users, showAllReviewUsers]);
  const hasMoreReviewUsers = codeReviewAnalysis.users.length > TABLE_PREVIEW_COUNT;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Copilot Cloud Agent Adoption</h2>
          <p className="text-sm text-[#636c76] mt-1">
            {adoptionRate.toFixed(0)}% adoption ({codingAgentUsers.length} of {totalUniqueUsers} users)
          </p>
        </div>
        <div className="flex gap-2">
          {isMobile && (
            <button
              onClick={() => setShowChart(!showChart)}
              className="px-3 py-1.5 text-sm font-medium text-[#636c76] bg-[#f6f8fa] hover:bg-[#d1d9e0] rounded-md transition-colors"
            >
              {showChart ? 'Table' : 'Chart'}
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      {(!isMobile || showChart) && dailyCodingAgentData.length > 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
          <h3 className="text-sm font-medium text-[#1f2328] mb-4">Usage Over Time</h3>
          <div className="h-56 sm:h-72">
            <CodingAgentUsageChart data={dailyCodingAgentData} />
          </div>
        </div>
      )}

      {/* Users Table */}
      {(!isMobile || !showChart) && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 className="text-sm font-medium text-[#1f2328]">Agent Users</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    User
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Premium Requests
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                    Quota
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {visibleUsers.map((user) => (
                  <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                      {user.user}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#1f2328] text-right">
                      {user.codingAgentRequests.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-[#636c76] text-right">
                      {user.quota === 'unknown' ? 'Unknown' : user.quota}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="px-5 py-3 border-t border-[#d1d9e0]">
              <button
                onClick={() => setShowAllUsers(!showAllUsers)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                {showAllUsers ? `Show top ${TABLE_PREVIEW_COUNT}` : `Show all ${codingAgentUsers.length} users`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Code Review Section */}
      {codeReviewAnalysis.users.length > 0 && (
        <>
          <div className="pt-4">
            <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Copilot Code Review Agent Adoption</h2>
            <p className="text-sm text-[#636c76] mt-1">
              {codeReviewAnalysis.adoptionRate.toFixed(0)}% adoption ({codeReviewAnalysis.totalUsers} of {codeReviewAnalysis.totalUniqueUsers} users)
            </p>
          </div>

          {/* Code Review Chart */}
          {(!isMobile || showChart) && dailyCodeReviewData.length > 0 && (
            <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
              <h3 className="text-sm font-medium text-[#1f2328] mb-4">Usage Over Time</h3>
              <div className="h-56 sm:h-72">
                <CodingAgentUsageChart data={dailyCodeReviewData} />
              </div>
            </div>
          )}

          {/* Code Review Users Table */}
          {(!isMobile || !showChart) && (
            <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
              <div className="px-5 py-4 border-b border-[#d1d9e0]">
                <h3 className="text-sm font-medium text-[#1f2328]">Code Review Users</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[#d1d9e0]">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">User</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Premium Requests</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Quota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d1d9e0]">
                    {visibleReviewUsers.map((user) => (
                      <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">{user.user}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#1f2328] text-right">{user.codeReviewRequests.toFixed(1)}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-[#636c76] text-right">{user.quota === 'unknown' ? 'Unknown' : user.quota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMoreReviewUsers && (
                <div className="px-5 py-3 border-t border-[#d1d9e0]">
                  <button
                    onClick={() => setShowAllReviewUsers(!showAllReviewUsers)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {showAllReviewUsers ? `Show top ${TABLE_PREVIEW_COUNT}` : `Show all ${codeReviewAnalysis.users.length} users`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
