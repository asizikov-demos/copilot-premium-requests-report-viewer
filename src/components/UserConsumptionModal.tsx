'use client';

import React, { useMemo, useContext } from 'react';
import { UserDailyStackedChart } from './charts/UserDailyStackedChart';
import { UserConsumptionModalProps } from '@/types/csv';
import {
  getUserData,
  calculateUserTotalRequests,
  calculateOverageRequests,
  calculateOverageCost,
  getUserOrgMetadata
} from '@/utils/userCalculations';
import { PRICING } from '@/constants/pricing';
import { FullScreenModal } from './primitives/FullScreenModal';
import { AnalysisContext } from '@/context/AnalysisContext';
import { buildUserDailyModelDataFromArtifacts, UsageArtifacts, QuotaArtifacts, DailyBucketsArtifacts, getUserQuota } from '@/utils/ingestion';
import { generateModelColors } from '@/utils/modelColors';

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function UserDailyUsageTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length && label) {
    const date = new Date(label);
    const formattedDate = date.toLocaleDateString('en-US', { timeZone: 'UTC' });

    // Separate cumulative line from model bars
    const cumulativeData = payload.find((entry: TooltipEntry) => entry.dataKey === 'totalCumulative');
    const modelData = payload.filter(
      (entry: TooltipEntry) => entry.dataKey !== 'totalCumulative' && entry.value > 0
    );

    // Calculate daily total from model data
    const dailyTotal = modelData.reduce((sum: number, entry: TooltipEntry) => sum + entry.value, 0);

    return (
      <div className="bg-white p-3 border border-[#d1d9e0] rounded-md shadow-sm">
        <p className="font-medium text-[#1f2328] mb-2">{formattedDate}</p>

        {/* Daily breakdown */}
        {modelData.length > 0 ? (
          <div className="mb-2">
            <p className="text-xs font-medium text-[#636c76] mb-1">Daily Usage</p>
            {modelData.map((entry: TooltipEntry, entryIndex: number) => (
              <p key={entryIndex} className="text-xs ml-2" style={{ color: entry.color }}>
                {entry.dataKey}: {entry.value.toFixed(1)}
              </p>
            ))}
            <p className="text-xs font-semibold text-[#1f2328] ml-2 mt-1">
              Total: {dailyTotal.toFixed(1)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#636c76] mb-2">No requests</p>
        )}

        {/* Cumulative total */}
        {cumulativeData && (
          <p className="text-xs text-blue-600 font-medium border-t border-[#d1d9e0] pt-2">
            Cumulative: {cumulativeData.value.toFixed(1)}
          </p>
        )}
      </div>
    );
  }

  return null;
}

export function UserConsumptionModal({
  user,
  processedData,
  userQuotaValue,
  onClose
}: UserConsumptionModalProps) {
  // Optional context (may be absent in isolated test rendering)
  const analysisCtx = useContext(AnalysisContext);

  // Artifact references (undefined when context absent)
  const usageArtifacts = analysisCtx?.usageArtifacts as UsageArtifacts | undefined;
  const dailyBucketsArtifacts = analysisCtx?.dailyBucketsArtifacts as DailyBucketsArtifacts | undefined;
  const quotaArtifacts = analysisCtx?.quotaArtifacts as QuotaArtifacts | undefined;

  const artifactUserQuota = quotaArtifacts ? getUserQuota(quotaArtifacts, user) : undefined;
  const effectiveUserQuotaValue = artifactUserQuota !== undefined ? artifactUserQuota : userQuotaValue;

  // Generate daily model data for this user
  const userDailyData = useMemo(() => {
    if (usageArtifacts && dailyBucketsArtifacts?.dailyUserModelTotals) {
      return buildUserDailyModelDataFromArtifacts(dailyBucketsArtifacts, usageArtifacts, user);
    }
    // Minimal legacy fallback for tests (re-implemented locally after removing transformations.ts)
    const userRows = processedData.filter(d => d.user === user);
    if (userRows.length === 0) return [];
    const allSorted = [...processedData].sort((a,b)=> a.epoch - b.epoch);
    const start = allSorted[0].epoch; const end = allSorted[allSorted.length-1].epoch;
    const models = Array.from(new Set(userRows.map(r=>r.model))).sort();
    const byDate = new Map<string, typeof processedData>();
    userRows.forEach(r => { const arr = byDate.get(r.dateKey); if (arr) arr.push(r); else byDate.set(r.dateKey,[r]); });
    let cumulative = 0; const result: import('@/types/csv').UserDailyData[] = [];
    for (let current = new Date(start); current.getTime() <= end; current.setUTCDate(current.getUTCDate()+1)) {
      const dateStr = current.toISOString().slice(0,10);
      const day = byDate.get(dateStr) || [];
      const row: import('@/types/csv').UserDailyData = { date: dateStr, totalCumulative: 0 } as import('@/types/csv').UserDailyData;
      let dailyTotal = 0; models.forEach(m => { row[m] = 0; });
      for (const rec of day) { row[rec.model] = (row[rec.model] as number) + rec.requestsUsed; dailyTotal += rec.requestsUsed; }
      cumulative += dailyTotal; row.totalCumulative = cumulative; result.push(row);
    }
    return result;
  }, [processedData, user, usageArtifacts, dailyBucketsArtifacts]);

  // Get filtered user data (single source of truth)
  const userData = useMemo(() => {
    return getUserData(processedData, user);
  }, [processedData, user]);

  const { organization, costCenter } = useMemo(
    () => getUserOrgMetadata(processedData, user),
    [processedData, user]
  );

  // Get models used by this user
  const userModels = useMemo(() => {
    return Array.from(new Set(userData.map(d => d.model))).sort();
  }, [userData]);

  const modelColors = useMemo(() => generateModelColors(userModels), [userModels]);

  // Calculate user's total requests using shared utility
  const userTotalRequests = useMemo(() => {
    if (usageArtifacts) {
      const agg = usageArtifacts.users.find(u => u.user === user);
      if (agg) return agg.totalRequests;
    }
    return calculateUserTotalRequests(processedData, user);
  }, [processedData, user, usageArtifacts]);

  // Calculate overage requests and cost using user's actual quota
  const effectiveQuota = effectiveUserQuotaValue === 'unlimited' ? Infinity : effectiveUserQuotaValue;
  const overageRequests = useMemo(() => {
    return calculateOverageRequests(userTotalRequests, effectiveQuota);
  }, [userTotalRequests, effectiveQuota]);

  const overageCost = useMemo(() => {
    return calculateOverageCost(overageRequests);
  }, [overageRequests]);

  // Calculate total requests per model
  const modelUsageTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    userDailyData.forEach(day => {
      userModels.forEach(model => {
        const value = day[model];
        if (typeof value === 'number') {
          totals[model] = (totals[model] || 0) + value;
        }
      });
    });
    return totals;
  }, [userDailyData, userModels]);

  // Sort models by usage
  const sortedModels = useMemo(() => {
    return [...userModels].sort((a, b) => (modelUsageTotals[b] || 0) - (modelUsageTotals[a] || 0));
  }, [userModels, modelUsageTotals]);

  const planInfo = {
    business: { name: 'Copilot Business', monthlyQuota: PRICING.BUSINESS_QUOTA },
    enterprise: { name: 'Copilot Enterprise', monthlyQuota: PRICING.ENTERPRISE_QUOTA }
  };

  // Determine the user's actual plan based on their quota value
  const userActualPlan = useMemo(() => {
    if (userQuotaValue === 'unlimited') {
      return 'unlimited';
    } else if (userQuotaValue === PRICING.BUSINESS_QUOTA) {
      return 'business';
    } else if (userQuotaValue === PRICING.ENTERPRISE_QUOTA) {
      return 'enterprise';
    } else {
      // Fallback to closest match
      return userQuotaValue < 650 ? 'business' : 'enterprise';
    }
  }, [userQuotaValue]);


  // Handle copy to clipboard
  const handleCopyUser = async () => {
    try {
      await navigator.clipboard.writeText(user);
    } catch (err) {
      console.error('Failed to copy user to clipboard:', err);
    }
  };

  return (
    <FullScreenModal
      open={true}
      onClose={onClose}
      title={`${user} Daily Usage`}
      contentClassName="flex flex-col"
      customHeader={(
        <div className="px-5 py-4 border-b border-[#d1d9e0] flex items-center justify-between flex-shrink-0" id="modal-title">
          <div className="flex-1 min-w-0">
            <button
              onClick={handleCopyUser}
              className="text-lg font-semibold text-[#1f2328] truncate hover:text-indigo-600 transition-colors duration-150 focus:outline-none rounded inline-flex items-center gap-2 group"
              title="Click to copy username"
            >
              {user}
              <svg
                className="w-4 h-4 text-[#636c76] group-hover:text-indigo-600 transition-colors duration-150"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
              <p className="text-xs text-[#636c76] truncate">
                {userActualPlan === 'unlimited'
                  ? 'Unlimited'
                  : planInfo[userActualPlan as 'business' | 'enterprise'].name}
                {organization ? ` • ${organization}` : ''}
                {costCenter ? ` • ${costCenter}` : ''}
                {' • '}
                {userTotalRequests.toFixed(1)} / {effectiveUserQuotaValue === 'unlimited' ? '∞' : effectiveUserQuotaValue}
              </p>
              {overageRequests > 0 && effectiveUserQuotaValue !== 'unlimited' && (
                <p className="text-xs text-red-600 font-medium truncate" role="alert">
                  Overage: ${overageCost.toFixed(2)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#636c76] hover:text-[#1f2328] transition-colors duration-150 ml-4 flex-shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    >
      <div className="flex-1 p-4 flex flex-col min-h-0">
        {userDailyData.length > 0 ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="text-xs text-[#636c76] bg-[#f6f8fa] p-2 rounded-md flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>Bars:</strong> Daily by model</span>
              <span><strong>Black line:</strong> Cumulative</span>
              <span><strong>Red line:</strong> Quota</span>
            </div>
            <div className="flex-1 min-h-0 w-full">
              <UserDailyStackedChart
                data={userDailyData}
                models={userModels}
                modelColors={modelColors}
                quotaValue={userQuotaValue}
                tooltip={<UserDailyUsageTooltip />}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
            No data available
          </div>
        )}
        {userModels.length > 0 && (
          <div className="border-t border-[#d1d9e0] pt-3 mt-3">
            <h4 className="text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] mb-2">Models Used</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {sortedModels.map((model) => (
                <div key={model} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: modelColors[model] }}
                  />
                  <span className="text-xs text-[#636c76] truncate max-w-[140px]" title={model}>
                    {model.length > 18 ? `${model.substring(0, 18)}...` : model}
                  </span>
                  <span className="text-xs text-[#636c76] font-mono">
                    {modelUsageTotals[model]?.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FullScreenModal>
  );
}
