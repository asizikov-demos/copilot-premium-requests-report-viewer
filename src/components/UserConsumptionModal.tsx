'use client';

import React, { useEffect, useState, useMemo, useContext } from 'react';
import { UserDailyStackedChart } from './charts/UserDailyStackedChart';
import { UserConsumptionModalProps } from '@/types/csv';
import { generateUserDailyModelData } from '@/utils/analytics'; // legacy fallback
import {
  getUserData,
  calculateUserTotalRequests,
  calculateOverageRequests,
  calculateOverageCost
} from '@/utils/userCalculations';
import { PRICING } from '@/constants/pricing';
import { FullScreenModal } from './primitives/FullScreenModal';
import { AnalysisContext } from '@/context/AnalysisContext';
import { buildUserDailyModelDataFromArtifacts, UsageArtifacts, QuotaArtifacts, DailyBucketsArtifacts, getUserQuota } from '@/utils/ingestion';

// Generate colors for model bars
const generateModelColors = (models: string[]): Record<string, string> => {
  const colors = [
    '#3B82F6', // blue-500
    '#EF4444', // red-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#8B5CF6', // violet-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
    '#F97316', // orange-500
    '#EC4899', // pink-500
    '#6366F1', // indigo-500
    '#14B8A6', // teal-500
    '#F43F5E', // rose-500
  ];
  
  const result: Record<string, string> = {};
  models.forEach((model, index) => {
    result[model] = colors[index % colors.length];
  });
  return result;
};

export function UserConsumptionModal({
  user,
  processedData,
  userQuotaValue,
  onClose
}: UserConsumptionModalProps) {
  const [mounted, setMounted] = useState(false);
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
    // Prefer artifact pathway when all required artifacts present & enriched map exists
    if (usageArtifacts && dailyBucketsArtifacts?.dailyUserModelTotals) {
      return buildUserDailyModelDataFromArtifacts(dailyBucketsArtifacts, usageArtifacts, user);
    }
    // Fallback to legacy row-scan function (tests still pass ProcessedData only)
    return generateUserDailyModelData(processedData, user);
  }, [processedData, user, usageArtifacts, dailyBucketsArtifacts]);

  // Get filtered user data (single source of truth)
  const userData = useMemo(() => {
    return getUserData(processedData, user);
  }, [processedData, user]);

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

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Define proper types for tooltip data
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

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length && label) {
      const date = new Date(label);
      const formattedDate = date.toLocaleDateString('en-US', { timeZone: 'UTC' });
      
      // Separate cumulative line from model bars
      const cumulativeData = payload.find((entry: TooltipEntry) => entry.dataKey === 'totalCumulative');
      const modelData = payload.filter((entry: TooltipEntry) => entry.dataKey !== 'totalCumulative' && entry.value > 0);
      
      // Calculate daily total from model data
      const dailyTotal = modelData.reduce((sum: number, entry: TooltipEntry) => sum + entry.value, 0);
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{formattedDate}</p>
          
          {/* Daily breakdown */}
          {modelData.length > 0 ? (
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-700 mb-1">Daily Usage:</p>
              {modelData.map((entry: TooltipEntry, entryIndex: number) => (
                <p key={entryIndex} className="text-sm ml-2" style={{ color: entry.color }}>
                  • {entry.dataKey}: {entry.value.toFixed(1)} requests
                </p>
              ))}
              <p className="text-sm font-semibold text-gray-900 ml-2 mt-1">
                Daily Total: {dailyTotal.toFixed(1)} requests
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-2">No requests this day</p>
          )}
          
          {/* Cumulative total */}
          {cumulativeData && (
            <p className="text-sm text-blue-600 font-semibold border-t border-gray-200 pt-2">
              Cumulative Total: {cumulativeData.value.toFixed(1)} requests
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Handle copy to clipboard
  const handleCopyUser = async () => {
    try {
      await navigator.clipboard.writeText(user);
    } catch (err) {
      console.error('Failed to copy user to clipboard:', err);
    }
  };

  if (!mounted) return null;

  return (
    <FullScreenModal
      open={mounted}
      onClose={onClose}
      title={`${user} Daily Usage`}
      contentClassName="flex flex-col"
      customHeader={(
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0" id="modal-title">
          <div className="flex-1 min-w-0">
            <button
              onClick={handleCopyUser}
              className="text-lg sm:text-xl font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded inline-flex items-center gap-2 group"
              title="Click to copy username"
            >
              {user}
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 mt-1">
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {userActualPlan === 'unlimited'
                  ? 'Unlimited Plan'
                  : planInfo[userActualPlan as 'business' | 'enterprise'].name}
                {' '} - Daily Usage Overview
              </p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Total requests: {userTotalRequests.toFixed(1)} / {effectiveUserQuotaValue === 'unlimited' ? 'Unlimited' : effectiveUserQuotaValue} quota
              </p>
              {overageRequests > 0 && effectiveUserQuotaValue !== 'unlimited' && (
                <p className="text-xs sm:text-sm text-red-600 font-medium truncate" role="alert">
                  Overage cost: ${overageCost.toFixed(2)} ({overageRequests.toFixed(1)} × ${PRICING.OVERAGE_RATE_PER_REQUEST.toFixed(2)})
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4 flex-shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    >
      <div className="flex-1 p-2 sm:p-4 flex flex-col min-h-0">
        {userDailyData.length > 0 ? (
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <div className="text-xs sm:text-sm text-gray-600 bg-gray-50 p-2 rounded-lg flex flex-wrap gap-x-4 gap-y-1">
              <p className="whitespace-nowrap"><strong>Chart Explanation:</strong></p>
              <p className="whitespace-nowrap">• <strong>Stacked Bars:</strong> Daily requests per model</p>
              <p className="whitespace-nowrap">• <strong>Black Line:</strong> Cumulative total requests</p>
              <p className="whitespace-nowrap">• <strong>Red Line:</strong> Quota limit</p>
            </div>
            <div className="flex-1 min-h-0 w-full">
              <UserDailyStackedChart
                data={userDailyData}
                models={userModels}
                modelColors={modelColors}
                quotaValue={userQuotaValue}
                tooltip={<CustomTooltip />}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No data available for this user
          </div>
        )}
        {userModels.length > 0 && (
          <div className="border-t border-gray-200 pt-2">
            <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-1 sm:mb-2">Models Used</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {sortedModels.map((model) => (
                <div key={model} className="flex items-center space-x-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded"
                    style={{ backgroundColor: modelColors[model] }}
                  />
                  <span className="text-xs text-gray-600 truncate max-w-[150px]" title={model}>
                    {model.length > 20 ? `${model.substring(0, 20)}...` : model} × {modelUsageTotals[model]?.toFixed(1)}
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
