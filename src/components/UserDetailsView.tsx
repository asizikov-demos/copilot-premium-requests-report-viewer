'use client';

import React, { useContext, useMemo } from 'react';

import { COST_OPTIMIZATION_THRESHOLDS, PRICING } from '@/constants/pricing';
import { AnalysisContext } from '@/context/AnalysisContext';
import { UserDailyStackedChart } from '@/components/charts/UserDailyStackedChart';
import type { ProcessedData, UserDailyData } from '@/types/csv';
import {
  buildUserDailyModelDataFromArtifacts,
  DailyBucketsArtifacts,
  getUserQuota,
  QuotaArtifacts,
  UsageArtifacts,
} from '@/utils/ingestion';
import { generateModelColors } from '@/utils/modelColors';
import { calculateEnterpriseUpgradeSavings } from '@/utils/analytics/costOptimization';
import { classifyProductCategory } from '@/utils/productClassification';
import {
  calculateBilledOverageFromRows,
  calculateOverageCost,
  calculateOverageRequests,
  calculateUserTotalRequests,
  getUserData,
  getUserOrgMetadata,
} from '@/utils/userCalculations';

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

export interface UserDetailsViewProps {
  user: string;
  processedData: ProcessedData[];
  userQuotaValue: number | 'unlimited';
  onBack: () => void;
}

function UserDailyUsageTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length && label) {
    const date = new Date(label);
    const formattedDate = date.toLocaleDateString('en-US', { timeZone: 'UTC' });

    const cumulativeData = payload.find((entry: TooltipEntry) => entry.dataKey === 'totalCumulative');
    const modelData = payload.filter(
      (entry: TooltipEntry) => entry.dataKey !== 'totalCumulative' && entry.value > 0
    );
    const dailyTotal = modelData.reduce((sum: number, entry: TooltipEntry) => sum + entry.value, 0);

    return (
      <div className="bg-white p-3 border border-[#d1d9e0] rounded-md shadow-sm">
        <p className="font-medium text-[#1f2328] mb-2">{formattedDate}</p>

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

        {cumulativeData && (
          <p className="text-xs text-indigo-600 font-medium border-t border-[#d1d9e0] pt-2">
            Cumulative: {cumulativeData.value.toFixed(1)}
          </p>
        )}
      </div>
    );
  }

  return null;
}

export function UserDetailsView({
  user,
  processedData,
  userQuotaValue,
  onBack,
}: UserDetailsViewProps) {
  const analysisCtx = useContext(AnalysisContext);

  const usageArtifacts = analysisCtx?.usageArtifacts as UsageArtifacts | undefined;
  const dailyBucketsArtifacts = analysisCtx?.dailyBucketsArtifacts as DailyBucketsArtifacts | undefined;
  const quotaArtifacts = analysisCtx?.quotaArtifacts as QuotaArtifacts | undefined;

  const artifactUserQuota = quotaArtifacts ? getUserQuota(quotaArtifacts, user) : undefined;
  const effectiveUserQuotaValue = artifactUserQuota !== undefined ? artifactUserQuota : userQuotaValue;

  const userDailyData = useMemo(() => {
    if (usageArtifacts && dailyBucketsArtifacts?.dailyUserModelTotals) {
      return buildUserDailyModelDataFromArtifacts(dailyBucketsArtifacts, usageArtifacts, user);
    }

    const userRows = processedData.filter((entry) => entry.user === user);
    if (userRows.length === 0) {
      return [];
    }

    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;

    for (const row of processedData) {
      if (row.epoch < start) {
        start = row.epoch;
      }
      if (row.epoch > end) {
        end = row.epoch;
      }
    }
    const models = Array.from(new Set(userRows.map((row) => row.model))).sort();
    const byDate = new Map<string, ProcessedData[]>();

    userRows.forEach((row) => {
      const entries = byDate.get(row.dateKey);
      if (entries) {
        entries.push(row);
      } else {
        byDate.set(row.dateKey, [row]);
      }
    });

    let cumulative = 0;
    const result: UserDailyData[] = [];

    for (let current = new Date(start); current.getTime() <= end; current.setUTCDate(current.getUTCDate() + 1)) {
      const dateStr = current.toISOString().slice(0, 10);
      const day = byDate.get(dateStr) || [];
      const row: UserDailyData = { date: dateStr, totalCumulative: 0 } as UserDailyData;
      let dailyTotal = 0;

      models.forEach((model) => {
        row[model] = 0;
      });

      for (const record of day) {
        row[record.model] = (row[record.model] as number) + record.requestsUsed;
        dailyTotal += record.requestsUsed;
      }

      cumulative += dailyTotal;
      row.totalCumulative = cumulative;
      result.push(row);
    }

    return result;
  }, [processedData, user, usageArtifacts, dailyBucketsArtifacts]);

  const userData = useMemo(() => getUserData(processedData, user), [processedData, user]);

  const { organization, costCenter } = useMemo(
    () => getUserOrgMetadata(processedData, user),
    [processedData, user]
  );

  const userModels = useMemo(() => Array.from(new Set(userData.map((entry) => entry.model))).sort(), [userData]);
  const modelColors = useMemo(() => generateModelColors(userModels), [userModels]);

  const userTotalRequests = useMemo(() => {
    if (usageArtifacts) {
      const aggregate = usageArtifacts.users.find((entry) => entry.user === user);
      if (aggregate) {
        return aggregate.totalRequests;
      }
    }

    return calculateUserTotalRequests(processedData, user);
  }, [processedData, user, usageArtifacts]);

  const effectiveQuota = effectiveUserQuotaValue === 'unlimited' ? Infinity : effectiveUserQuotaValue;
  const billedOverage = useMemo(() => calculateBilledOverageFromRows(userData), [userData]);
  const estimatedOverageRequests = useMemo(
    () => calculateOverageRequests(userTotalRequests, effectiveQuota),
    [userTotalRequests, effectiveQuota]
  );
  const estimatedOverageCost = useMemo(() => calculateOverageCost(estimatedOverageRequests), [estimatedOverageRequests]);
  const overageRequests = billedOverage.hasBilledOverageData ? billedOverage.overageRequests : estimatedOverageRequests;
  const overageCost = billedOverage.hasBilledOverageData ? billedOverage.overageCost : estimatedOverageCost;

  const modelUsageTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    userDailyData.forEach((day) => {
      userModels.forEach((model) => {
        const value = day[model];
        if (typeof value === 'number') {
          totals[model] = (totals[model] || 0) + value;
        }
      });
    });

    return totals;
  }, [userDailyData, userModels]);

  const sortedModels = useMemo(
    () => [...userModels].sort((left, right) => (modelUsageTotals[right] || 0) - (modelUsageTotals[left] || 0)),
    [userModels, modelUsageTotals]
  );

  type DailyModelRow = {
    date: string;
    model: string;
    requests: number;
    gross: number;
    discount: number;
    net: number;
    isFirstInDate: boolean;
    rowSpan: number;
  };

  const dailyBreakdownRows = useMemo((): DailyModelRow[] => {
    const hasBillingData = userData.some(
      (row) => row.grossAmount !== undefined || row.netAmount !== undefined || row.discountAmount !== undefined
    );
    if (!hasBillingData) return [];

    // Aggregate by date + model
    type Key = string;
    const agg = new Map<Key, { date: string; model: string; requests: number; gross: number; discount: number; net: number }>();
    for (const row of userData) {
      const key = `${row.dateKey}||${row.model}`;
      const existing = agg.get(key);
      if (existing) {
        existing.requests += row.requestsUsed;
        existing.gross += row.grossAmount ?? 0;
        existing.discount += row.discountAmount ?? 0;
        existing.net += row.netAmount ?? 0;
      } else {
        agg.set(key, {
          date: row.dateKey,
          model: row.model,
          requests: row.requestsUsed,
          gross: row.grossAmount ?? 0,
          discount: row.discountAmount ?? 0,
          net: row.netAmount ?? 0,
        });
      }
    }

    // Sort by date asc, then model
    const sorted = Array.from(agg.values()).sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.model.localeCompare(b.model)
    );

    // Count rows per date for rowSpan
    const dateSpan = new Map<string, number>();
    for (const r of sorted) dateSpan.set(r.date, (dateSpan.get(r.date) ?? 0) + 1);

    const seenDates = new Set<string>();
    return sorted.map((r) => {
      const isFirst = !seenDates.has(r.date);
      if (isFirst) seenDates.add(r.date);
      return { ...r, isFirstInDate: isFirst, rowSpan: dateSpan.get(r.date) ?? 1 };
    });
  }, [userData]);

  type ProductCost = { label: string; requests: number; gross: number; discount: number; net: number };
  const productCosts = useMemo((): ProductCost[] => {
    const hasBillingData = userData.some(
      (row) => row.grossAmount !== undefined || row.netAmount !== undefined || row.discountAmount !== undefined
    );
    if (!hasBillingData) return [];

    const buckets = {
      codingAgent: { label: 'Cloud Agent', requests: 0, gross: 0, discount: 0, net: 0 },
      codeReview: { label: 'Code Review', requests: 0, gross: 0, discount: 0, net: 0 },
      copilot: { label: 'Copilot', requests: 0, gross: 0, discount: 0, net: 0 },
    };

    for (const row of userData) {
      const category = classifyProductCategory(row.model);
      const bucket =
        category === 'Coding Agent' ? buckets.codingAgent
        : category === 'Code Review' ? buckets.codeReview
        : buckets.copilot;
      bucket.requests += row.requestsUsed;
      bucket.gross += row.grossAmount ?? 0;
      bucket.discount += row.discountAmount ?? 0;
      bucket.net += row.netAmount ?? 0;
    }

    return [buckets.copilot, buckets.codingAgent, buckets.codeReview].filter((b) => b.requests > 0);
  }, [userData]);

  const planInfo = {
    business: { name: 'Copilot Business', monthlyQuota: PRICING.BUSINESS_QUOTA },
    enterprise: { name: 'Copilot Enterprise', monthlyQuota: PRICING.ENTERPRISE_QUOTA },
  };

  const userActualPlan = useMemo(() => {
    if (effectiveUserQuotaValue === 'unlimited') {
      return 'unlimited';
    }
    if (effectiveUserQuotaValue === PRICING.BUSINESS_QUOTA) {
      return 'business';
    }
    if (effectiveUserQuotaValue === PRICING.ENTERPRISE_QUOTA) {
      return 'enterprise';
    }

    return effectiveUserQuotaValue < 650 ? 'business' : 'enterprise';
  }, [effectiveUserQuotaValue]);

  const handleCopyUser = async () => {
    try {
      await navigator.clipboard.writeText(user);
    } catch (error) {
      console.error('Failed to copy user to clipboard:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header — breadcrumbs + secondary stats, no background */}
      <div>
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
                <button
                  type="button"
                  onClick={onBack}
                  className="text-2xl font-semibold tracking-tight text-[#0969da] hover:underline focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
                >
                  users
                </button>
            </li>
            <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-[#8c959f]">/</li>
            <li>
                <button
                  type="button"
                  onClick={handleCopyUser}
                  title="Click to copy username"
                  className="text-2xl font-semibold tracking-tight text-[#1f2328] hover:text-indigo-600 transition-colors duration-150 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm inline-flex items-center gap-2 group"
                >
                {user}
                <svg
                  className="w-5 h-5 text-[#636c76] group-hover:text-indigo-600 transition-colors duration-150"
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
            </li>
          </ol>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
          <p className="text-sm text-[#636c76]">
            {userActualPlan === 'unlimited'
              ? 'Unlimited'
              : planInfo[userActualPlan as 'business' | 'enterprise'].name}
            {organization ? ` • ${organization}` : ''}
            {costCenter ? ` • ${costCenter}` : ''}
            {' • '}
            {userTotalRequests.toFixed(1)} / {effectiveUserQuotaValue === 'unlimited' ? '∞' : effectiveUserQuotaValue} PRUs consumed
          </p>
          {overageRequests > 0 && effectiveUserQuotaValue !== 'unlimited' && (
            <p className="text-sm text-red-600 font-medium" role="alert">
              Overage: {overageRequests.toFixed(1)} PRUs · ${overageCost.toFixed(2)}
            </p>
          )}
        </div>

        {userActualPlan === 'business' &&
          overageRequests >= COST_OPTIMIZATION_THRESHOLDS.STRONG_CANDIDATE_THRESHOLD && (() => {
            const savings = calculateEnterpriseUpgradeSavings(overageRequests);
            return (
              <div className="mt-3 flex items-start gap-3 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-md">
                <svg className="w-4 h-4 text-[#2da44e] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-[#1f2328]">
                  <span className="font-semibold text-[#2da44e]">Cost saving opportunity: </span>
                  Upgrading this user to <span className="font-medium">Copilot Enterprise</span> would have saved{' '}
                  <span className="font-semibold text-[#2da44e]">${savings.potentialSavings.toFixed(2)}</span> this period.
                </p>
              </div>
            );
          })()}
      </div>

      {/* Cost per Product — standalone card */}
      {productCosts.length > 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 className="text-sm font-medium text-[#1f2328]">Cost per Product</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Product</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Requests</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Gross</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Discount</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {productCosts.map((product) => (
                  <tr key={product.label} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-[#1f2328]">{product.label}</td>
                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">{product.requests.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">${product.gross.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm text-emerald-600 text-right font-mono">-${product.discount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] text-right font-mono">${product.net.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Model Usage chart — standalone card */}
      <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
        <h3 className="text-sm font-medium text-[#1f2328] mb-1">Daily Model Usage</h3>
        <p className="text-xs text-[#636c76] mb-4">
          Bars: daily by model · Black line: cumulative · Red line: quota
        </p>

        {userDailyData.length > 0 ? (
          <>
            <div className="h-72 sm:h-96 2xl:h-[28rem] w-full">
              <UserDailyStackedChart
                data={userDailyData}
                models={userModels}
                modelColors={modelColors}
                quotaValue={effectiveUserQuotaValue}
                tooltip={<UserDailyUsageTooltip />}
              />
            </div>

            {userModels.length > 0 && (
              <div className="border-t border-[#d1d9e0] pt-4 mt-4">
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
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
            No data available
          </div>
        )}
      </div>

      {/* Daily Model Usage Breakdown table — standalone card */}
      {dailyBreakdownRows.length > 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 className="text-sm font-medium text-[#1f2328]">Daily Model Usage Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-5 py-3 w-28 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Date</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Model</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Requests</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Gross Cost</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Discounts</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Net Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {dailyBreakdownRows.map((row, idx) => (
                  <tr key={`${row.date}-${row.model}-${idx}`} className="hover:bg-[#fcfdff] transition-colors">
                    {row.isFirstInDate ? (
                      <td
                        rowSpan={row.rowSpan}
                        className="px-5 py-3 w-28 text-sm font-medium text-[#1f2328] whitespace-nowrap align-top"
                      >
                        {row.date}
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-sm text-[#636c76]">- {row.model}</td>
                    <td className="px-5 py-3 text-sm font-mono text-[#1f2328] text-right">{row.requests.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-[#636c76] text-right">${row.gross.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-emerald-600 text-right">-${row.discount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm font-mono font-semibold text-[#1f2328] text-right">${row.net.toFixed(2)}</td>
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
