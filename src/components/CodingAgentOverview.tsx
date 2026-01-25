'use client';

import React, { useState, useMemo } from 'react';
import { CodingAgentUsageChart } from './charts/CodingAgentUsageChart';
import { useIsMobile } from '@/hooks/useIsMobile';
import { AnalysisContext } from '@/context/AnalysisContext';
import { DailyBucketsArtifacts, buildDailyCodingAgentUsageFromArtifacts } from '@/utils/ingestion';

interface CodingAgentOverviewProps {
  codingAgentUsers: import('@/types/csv').CodingAgentUser[];
  totalUniqueUsers: number;
  adoptionRate: number;
  onBack: () => void;
}

export function CodingAgentOverview({ 
  codingAgentUsers, 
  totalUniqueUsers,
  adoptionRate, 
  onBack 
}: CodingAgentOverviewProps) {
  const isMobile = useIsMobile();
  const [showChart, setShowChart] = useState(true);
  const analysisCtx = React.useContext(AnalysisContext);
  const dailyBucketsArtifacts = analysisCtx?.dailyBucketsArtifacts as DailyBucketsArtifacts | undefined;
  
  // Memoize daily coding agent data calculation
  const dailyCodingAgentData = useMemo(() => {
    if (dailyBucketsArtifacts?.dailyUserModelTotals) {
      return buildDailyCodingAgentUsageFromArtifacts(dailyBucketsArtifacts);
    }
    return [];
  }, [dailyBucketsArtifacts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Coding Agent Adoption</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {adoptionRate.toFixed(0)}% adoption ({codingAgentUsers.length} of {totalUniqueUsers} users)
          </p>
        </div>
        <div className="flex gap-2">
          {isMobile && (
            <button
              onClick={() => setShowChart(!showChart)}
              className="px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              {showChart ? 'Table' : 'Chart'}
            </button>
          )}
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
        </div>
      </div>

      {/* Chart */}
      {(!isMobile || showChart) && dailyCodingAgentData.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-900 mb-4">Usage Over Time</h3>
          <div className="h-56 sm:h-72">
            <CodingAgentUsageChart data={dailyCodingAgentData} />
          </div>
        </div>
      )}

      {/* Users Table */}
      {(!isMobile || !showChart) && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h3 className="text-sm font-medium text-zinc-900">Agent Users</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    User
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Agent
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Total
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    %
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    Quota
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {codingAgentUsers.map((user) => (
                  <tr key={user.user} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {user.user}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-900 text-right">
                      {user.codingAgentRequests.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-500 text-right">
                      {user.totalRequests.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-zinc-500 text-right">
                      {user.codingAgentPercentage.toFixed(0)}%
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm text-zinc-500 text-right">
                      {user.quota === 'unlimited' ? '∞' : user.quota}
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
