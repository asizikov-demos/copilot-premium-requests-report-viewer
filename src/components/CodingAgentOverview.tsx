'use client';

import React, { useState, useMemo } from 'react';

import { useAnalysisContext } from '@/context/AnalysisContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { CodeReviewAnalysis, CodingAgentUser, ProcessedData } from '@/types/csv';
import { getBillingCostLabels } from '@/utils/billingLabels';
import {
  buildDailyCodeReviewUsageFromArtifacts,
  buildDailyCodingAgentUsageFromArtifacts,
  getSpecialUsageBucketLabel,
} from '@/utils/ingestion';
import { filterDailySeriesByMonths } from '@/utils/analytics/filters';
import { classifyProductCategory } from '@/utils/productClassification';

import { AgentUsersTable, type AgentUsageTableRow } from './charts/AgentUsersTable';
import { CodingAgentUsageChart } from './charts/CodingAgentUsageChart';

interface CodingAgentOverviewProps {
  codingAgentUsers: CodingAgentUser[];
  totalUniqueUsers: number;
  adoptionRate: number;
  codeReviewAnalysis: CodeReviewAnalysis;
}

function buildUsageBasedAgentRows(
  rows: ProcessedData[],
  category: 'Coding Agent' | 'Code Review'
): AgentUsageTableRow[] {
  const rowsByUser = new Map<string, AgentUsageTableRow>();

  for (const row of rows) {
    const rowCategory = classifyProductCategory(row.model, row.product, row.sku);
    if (rowCategory !== category) {
      continue;
    }

    const user = row.usageBucket ? getSpecialUsageBucketLabel(row.usageBucket) : row.user;
    const current = rowsByUser.get(user) ?? {
      user,
      quantity: 0,
      gross: 0,
      included: 0,
      additional: 0,
    };

    current.quantity += row.creditsUsed;
    current.gross += row.grossAmount ?? row.aicGrossAmount ?? 0;
    current.included += row.discountAmount ?? 0;
    current.additional += row.netAmount ?? 0;
    rowsByUser.set(user, current);
  }

  return Array.from(rowsByUser.values())
    .filter((row) => row.quantity > 0 || row.gross > 0 || row.included > 0 || row.additional > 0)
    .sort((left, right) => right.quantity - left.quantity);
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
  const { aggregateProcessedData, dailyBucketsArtifacts, selectedMonths } = useAnalysisContext();
  const quantityColumnLabel = 'AI Credits';
  const valueUnitLabel = 'AI Credits';
  const costLabels = useMemo(() => getBillingCostLabels(), []);
   
  // Memoize daily coding agent data, filtered by selected billing months
  const dailyCodingAgentData = useMemo(() => {
    return dailyBucketsArtifacts
      ? filterDailySeriesByMonths(buildDailyCodingAgentUsageFromArtifacts(dailyBucketsArtifacts), selectedMonths)
      : [];
  }, [dailyBucketsArtifacts, selectedMonths]);

  const dailyCodeReviewData = useMemo(() => {
    return dailyBucketsArtifacts
      ? filterDailySeriesByMonths(buildDailyCodeReviewUsageFromArtifacts(dailyBucketsArtifacts), selectedMonths)
      : [];
  }, [dailyBucketsArtifacts, selectedMonths]);

  const TABLE_PREVIEW_COUNT = 5;
  const codingAgentTableRows = useMemo<AgentUsageTableRow[]>(() => {
    return buildUsageBasedAgentRows(aggregateProcessedData, 'Coding Agent');
  }, [aggregateProcessedData]);

  const codeReviewTableRows = useMemo<AgentUsageTableRow[]>(() => {
    return buildUsageBasedAgentRows(aggregateProcessedData, 'Code Review');
  }, [aggregateProcessedData]);
  const showCosts = aggregateProcessedData.some((row) =>
    row.grossAmount !== undefined || row.discountAmount !== undefined || row.netAmount !== undefined
  );

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
          <h3 className="text-sm font-medium text-[#1f2328]">Usage Over Time</h3>
          <p className="text-xs text-[#636c76] mt-0.5 mb-4">
            Daily and cumulative {valueUnitLabel} usage
          </p>
          <div className="h-56 sm:h-72">
            <CodingAgentUsageChart data={dailyCodingAgentData} valueUnitLabel={valueUnitLabel} />
          </div>
        </div>
      )}

      {/* Users Table */}
      {(!isMobile || !showChart) && (
        <AgentUsersTable
          tableTitle="Agent Users"
          rows={codingAgentTableRows}
          showCosts={showCosts}
          quantityColumnLabel={quantityColumnLabel}
          costLabels={costLabels}
          showAll={showAllUsers}
          onToggleShowAll={() => setShowAllUsers(!showAllUsers)}
          previewCount={TABLE_PREVIEW_COUNT}
        />
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
              <h3 className="text-sm font-medium text-[#1f2328]">Usage Over Time</h3>
              <p className="text-xs text-[#636c76] mt-0.5 mb-4">
                Daily and cumulative {valueUnitLabel} usage
              </p>
              <div className="h-56 sm:h-72">
                <CodingAgentUsageChart data={dailyCodeReviewData} valueUnitLabel={valueUnitLabel} />
              </div>
            </div>
          )}

          {/* Code Review Users Table */}
          {(!isMobile || !showChart) && (
            <AgentUsersTable
              tableTitle="Code Review Users"
              rows={codeReviewTableRows}
              showCosts={showCosts}
              quantityColumnLabel={quantityColumnLabel}
              costLabels={costLabels}
              showAll={showAllReviewUsers}
              onToggleShowAll={() => setShowAllReviewUsers(!showAllReviewUsers)}
              previewCount={TABLE_PREVIEW_COUNT}
            />
          )}
        </>
      )}
    </div>
  );
}
