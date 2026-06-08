'use client';

import React, { useState, useMemo } from 'react';

import { useAnalysisContext } from '@/context/AnalysisContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { CodeReviewAnalysis, CodingAgentUser, ProcessedData } from '@/types/csv';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { formatCurrency } from '@/utils/formatters';
import {
  buildDailyCodeReviewAicUsageFromArtifacts,
  buildDailyCodeReviewUsageFromArtifacts,
  buildDailyCodingAgentAicUsageFromArtifacts,
  buildDailyCodingAgentUsageFromArtifacts,
  DailyBucketsArtifacts,
  NON_COPILOT_CODE_REVIEW_LABEL,
} from '@/utils/ingestion';
import { filterDailySeriesByMonths } from '@/utils/analytics/filters';
import { isCodeReviewModel, isCodingAgentModel } from '@/utils/productClassification';

import { CodingAgentUsageChart } from './charts/CodingAgentUsageChart';

interface CodingAgentOverviewProps {
  codingAgentUsers: CodingAgentUser[];
  totalUniqueUsers: number;
  adoptionRate: number;
  codeReviewAnalysis: CodeReviewAnalysis;
}

interface AgentUsageTableRow {
  user: string;
  quantity: number;
  gross: number;
  included: number;
  additional: number;
  quota: number | 'unknown';
  isSyntheticNonCopilotRow?: boolean;
}

function formatUsageQuantity(value: number, isUsageBasedBilling: boolean): string {
  if (isUsageBasedBilling) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return value.toFixed(1);
}

function formatQuotaValue(quota: number | 'unknown'): string {
  return quota === 'unknown' ? 'Unknown' : quota.toLocaleString();
}

function buildUsageBasedAgentRows(
  rows: ProcessedData[],
  modelFilter: (model: string) => boolean
): AgentUsageTableRow[] {
  const rowsByUser = new Map<string, AgentUsageTableRow>();

  for (const row of rows) {
    if (!modelFilter(row.model)) {
      continue;
    }

    const user = row.isNonCopilotUsage ? NON_COPILOT_CODE_REVIEW_LABEL : row.user;
    const current = rowsByUser.get(user) ?? {
      user,
      quantity: 0,
      gross: 0,
      included: 0,
      additional: 0,
      quota: row.isNonCopilotUsage ? 0 : row.quotaValue ?? 'unknown',
      isSyntheticNonCopilotRow: row.isNonCopilotUsage,
    };

    current.quantity += row.aicQuantity ?? row.billingQuantity ?? 0;
    current.gross += row.grossAmount ?? row.aicGrossAmount ?? 0;
    current.included += row.discountAmount ?? 0;
    current.additional += row.netAmount ?? 0;
    rowsByUser.set(user, current);
  }

  return Array.from(rowsByUser.values())
    .filter((row) => row.quantity > 0 || row.gross > 0 || row.included > 0 || row.additional > 0)
    .sort((left, right) => right.quantity - left.quantity);
}

function getVisibleRows<T extends { isSyntheticNonCopilotRow?: boolean }>(
  rows: T[],
  showAllRows: boolean,
  previewCount: number
): T[] {
  if (showAllRows) {
    return rows;
  }

  const preview = rows.slice(0, previewCount);
  const syntheticRow = rows.find((row) => row.isSyntheticNonCopilotRow);

  if (!syntheticRow || preview.some((row) => row.isSyntheticNonCopilotRow)) {
    return preview;
  }

  return [...preview.slice(0, Math.max(0, previewCount - 1)), syntheticRow];
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
  const typedDailyBuckets = dailyBucketsArtifacts as DailyBucketsArtifacts | undefined;
  const hasAiCreditUsage = aggregateProcessedData.some((row) => row.usageUnit === 'ai_credit');
  const hasRequestUsage = aggregateProcessedData.some((row) => row.usageUnit === 'request' && row.requestsUsed > 0);
  const isUsageBasedBilling = hasAiCreditUsage && !hasRequestUsage;
  const quantityColumnLabel = isUsageBasedBilling ? 'AI Credits' : 'Premium Requests';
  const valueUnitLabel = isUsageBasedBilling ? 'AI Credits' : 'requests';
  const costLabels = useMemo(() => getBillingCostLabels(isUsageBasedBilling), [isUsageBasedBilling]);
   
  // Memoize daily coding agent data, filtered by selected billing months
  const dailyCodingAgentData = useMemo(() => {
    if (typedDailyBuckets) {
      const raw = isUsageBasedBilling
        ? buildDailyCodingAgentAicUsageFromArtifacts(typedDailyBuckets)
        : buildDailyCodingAgentUsageFromArtifacts(typedDailyBuckets);
      return filterDailySeriesByMonths(raw, selectedMonths);
    }
    return [];
  }, [isUsageBasedBilling, typedDailyBuckets, selectedMonths]);

  const dailyCodeReviewData = useMemo(() => {
    if (typedDailyBuckets) {
      const raw = isUsageBasedBilling
        ? buildDailyCodeReviewAicUsageFromArtifacts(typedDailyBuckets)
        : buildDailyCodeReviewUsageFromArtifacts(typedDailyBuckets);
      return filterDailySeriesByMonths(raw, selectedMonths);
    }
    return [];
  }, [isUsageBasedBilling, typedDailyBuckets, selectedMonths]);

  const TABLE_PREVIEW_COUNT = 5;
  const codingAgentTableRows = useMemo<AgentUsageTableRow[]>(() => {
    if (isUsageBasedBilling) {
      return buildUsageBasedAgentRows(aggregateProcessedData, isCodingAgentModel);
    }

    return codingAgentUsers.map((user) => ({
      user: user.user,
      quantity: user.codingAgentRequests,
      gross: 0,
      included: 0,
      additional: 0,
      quota: user.quota,
    }));
  }, [aggregateProcessedData, codingAgentUsers, isUsageBasedBilling]);

  const codeReviewTableRows = useMemo<AgentUsageTableRow[]>(() => {
    if (isUsageBasedBilling) {
      return buildUsageBasedAgentRows(aggregateProcessedData, isCodeReviewModel);
    }

    return codeReviewAnalysis.users.map((user) => ({
      user: user.user,
      quantity: user.codeReviewRequests,
      gross: 0,
      included: 0,
      additional: 0,
      quota: user.quota,
      isSyntheticNonCopilotRow: user.isSyntheticNonCopilotRow,
    }));
  }, [aggregateProcessedData, codeReviewAnalysis.users, isUsageBasedBilling]);

  const visibleUsers = showAllUsers ? codingAgentTableRows : codingAgentTableRows.slice(0, TABLE_PREVIEW_COUNT);
  const hasMore = codingAgentTableRows.length > TABLE_PREVIEW_COUNT;

  const visibleReviewUsers = useMemo(() => (
    getVisibleRows(codeReviewTableRows, showAllReviewUsers, TABLE_PREVIEW_COUNT)
  ), [codeReviewTableRows, showAllReviewUsers]);
  const hasMoreReviewUsers = codeReviewTableRows.length > TABLE_PREVIEW_COUNT;

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
                    {quantityColumnLabel}
                  </th>
                  {isUsageBasedBilling ? (
                    <>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                        {costLabels.gross}
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                        {costLabels.discount}
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                        {costLabels.net}
                      </th>
                    </>
                  ) : (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                      Quota
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {visibleUsers.map((user) => (
                  <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                      {user.user}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#1f2328] text-right">
                      {formatUsageQuantity(user.quantity, isUsageBasedBilling)}
                    </td>
                    {isUsageBasedBilling ? (
                      <>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
                          {formatCurrency(user.gross)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-emerald-600 text-right">
                          -{formatCurrency(user.included)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-[#1f2328] text-right">
                          {formatCurrency(user.additional)}
                        </td>
                      </>
                    ) : (
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-[#636c76] text-right">
                        {formatQuotaValue(user.quota)}
                      </td>
                    )}
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
                {showAllUsers ? `Show top ${TABLE_PREVIEW_COUNT}` : `Show all ${codingAgentTableRows.length} users`}
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
            <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
              <div className="px-5 py-4 border-b border-[#d1d9e0]">
                <h3 className="text-sm font-medium text-[#1f2328]">Code Review Users</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[#d1d9e0]">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">User</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{quantityColumnLabel}</th>
                      {isUsageBasedBilling ? (
                        <>
                          <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.gross}</th>
                          <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.discount}</th>
                          <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.net}</th>
                        </>
                      ) : (
                        <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Quota</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d1d9e0]">
                    {visibleReviewUsers.map((user) => (
                      <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">{user.user}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#1f2328] text-right">{formatUsageQuantity(user.quantity, isUsageBasedBilling)}</td>
                        {isUsageBasedBilling ? (
                          <>
                            <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">{formatCurrency(user.gross)}</td>
                            <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-emerald-600 text-right">-{formatCurrency(user.included)}</td>
                            <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-[#1f2328] text-right">{formatCurrency(user.additional)}</td>
                          </>
                        ) : (
                          <td className="px-5 py-3 whitespace-nowrap text-sm text-[#636c76] text-right">{formatQuotaValue(user.quota)}</td>
                        )}
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
                    {showAllReviewUsers ? `Show top ${TABLE_PREVIEW_COUNT}` : `Show all ${codeReviewTableRows.length} users`}
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
