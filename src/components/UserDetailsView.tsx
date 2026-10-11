'use client';

import React, { useContext, useMemo } from 'react';

import { UserDetailsHeader } from '@/components/UserDetailsHeader';
import { UserConsumptionMetrics } from '@/components/UserConsumptionMetrics';
import { TOKEN_COLUMNS, TokenValue } from '@/components/TokenValue';
import { DailyConsumptionChart } from '@/components/charts/DailyConsumptionChart';
import { PRICING } from '@/constants/pricing';
import { AnalysisContext } from '@/context/AnalysisContext';
import { UserDailyStackedChart } from '@/components/charts/UserDailyStackedChart';
import { utcDateLabelFormatter } from '@/components/charts/chartTooltipStyles';
import type { ProcessedData, UserDailyData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import { getQuotaTier, isKnownQuotaValue } from '@/utils/analytics/quota';
import {
  buildUserDailyModelDataFromArtifacts,
  buildTokenArtifactsFromProcessedData,
  type TokenTotals,
  DailyBucketsArtifacts,
  getUserQuota,
  QuotaArtifacts,
  UsageArtifacts,
} from '@/utils/ingestion';
import { generateModelColors } from '@/utils/modelColors';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { enumerateDatesInclusive } from '@/utils/dateKeys';
import { aggregateDailyConsumption } from '@/utils/dailyConsumption';
import { formatCurrency } from '@/utils/formatters';
import { aggregateProductCosts } from '@/utils/productCosts';
import { buildUserHeaderSummary } from '@/utils/userHeaderSummary';
import {
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
  valueUnitLabel?: string;
}

interface UserCostCenterCost {
  name: string;
  quantity: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
}

export interface UserDetailsViewProps {
  user: string;
  processedData: ProcessedData[];
  userQuotaValue: number | 'unknown';
  userAggregate?: UserSummary | null;
  onBack: () => void;
}

function UserDailyUsageTooltip({ active, payload, label, valueUnitLabel = 'AI Credits' }: TooltipProps) {
  if (active && payload && payload.length && label) {
    const formattedDate = utcDateLabelFormatter(label);

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
                {entry.dataKey}: {entry.value.toFixed(1)} {valueUnitLabel}
              </p>
            ))}
            <p className="text-xs font-semibold text-[#1f2328] ml-2 mt-1">
              Total: {dailyTotal.toFixed(1)} {valueUnitLabel}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#636c76] mb-2">No {valueUnitLabel}</p>
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
  userAggregate,
  onBack,
}: UserDetailsViewProps) {
  const analysisCtx = useContext(AnalysisContext);

  const usageArtifacts = analysisCtx?.usageArtifacts as UsageArtifacts | undefined;
  const dailyBucketsArtifacts = analysisCtx?.dailyBucketsArtifacts as DailyBucketsArtifacts | undefined;
  const quotaArtifacts = analysisCtx?.quotaArtifacts as QuotaArtifacts | undefined;

  const artifactUserQuota = quotaArtifacts ? getUserQuota(quotaArtifacts, user) : undefined;
  const effectiveUserQuotaValue = artifactUserQuota !== undefined ? artifactUserQuota : userQuotaValue;

  const userData = useMemo(() => getUserData(processedData, user), [processedData, user]);
  const hasBillingData = useMemo(
    () => userData.some(
      (row) =>
        row.grossAmount !== undefined ||
        row.netAmount !== undefined ||
        row.discountAmount !== undefined ||
        row.aicGrossAmount !== undefined
    ),
    [userData]
  );
  const userQuantityColumnLabel = 'AI Credits';
  const chartValueUnitLabel = 'AI Credits';
  const userCostLabels = useMemo(() => getBillingCostLabels(), []);

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
    let currentMonth = '';
    const result: UserDailyData[] = [];
    const startDate = new Date(start).toISOString().slice(0, 10);
    const endDate = new Date(end).toISOString().slice(0, 10);

    for (const dateStr of enumerateDatesInclusive(startDate, endDate)) {
      if (dateStr.slice(0, 7) !== currentMonth) {
        currentMonth = dateStr.slice(0, 7);
        cumulative = 0;
      }
      const day = byDate.get(dateStr) || [];
      const row: UserDailyData = { date: dateStr, totalCumulative: 0 } as UserDailyData;
      let dailyTotal = 0;

      models.forEach((model) => {
        row[model] = 0;
      });

      for (const record of day) {
        const quantity = record.creditsUsed;
        row[record.model] = (row[record.model] as number) + quantity;
        dailyTotal += quantity;
      }

      cumulative += dailyTotal;
      row.totalCumulative = cumulative;
      result.push(row);
    }

    return result;
  }, [processedData, user, usageArtifacts, dailyBucketsArtifacts]);

  const effectiveUserAggregate = useMemo(
    () => userAggregate === undefined
      ? usageArtifacts?.users.find((entry) => entry.user === user)
      : userAggregate ?? undefined,
    [user, userAggregate, usageArtifacts]
  );
  const { organization, costCenter } = useMemo(() => {
    if (effectiveUserAggregate) {
      return {
        organization: effectiveUserAggregate.organization,
        costCenter: effectiveUserAggregate.costCenter,
      };
    }

    return getUserOrgMetadata(processedData, user);
  }, [effectiveUserAggregate, processedData, user]);

  const userModels = useMemo(() => Array.from(new Set(userData.map((entry) => entry.model))).sort(), [userData]);
  const modelColors = useMemo(() => generateModelColors(userModels), [userModels]);

  const quotaValue = isKnownQuotaValue(effectiveUserQuotaValue)
    ? effectiveUserQuotaValue
    : 'unknown';

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
    costCenter?: string;
    credits: number;
    gross: number;
    discount: number;
    net: number;
    aicGrossAmount: number;
    isFirstInDate: boolean;
    rowSpan: number;
    tokens?: TokenTotals;
  };

  const showAicGross = false;
  const showTokens = analysisCtx?.tokenArtifacts !== null &&
    userData.some(row => TOKEN_COLUMNS.some(({ field }) => row[field] !== undefined));
  const hasUserCostCenters = userData.some(row => Boolean(row.costCenter));

  const dailyBreakdownRows = useMemo((): DailyModelRow[] => {
    if (!hasBillingData && !showTokens) return [];

    // Aggregate by date + model + cost center so cost-center changes remain visible.
    type Key = string;
    const agg = new Map<Key, { date: string; model: string; costCenter?: string; credits: number; gross: number; discount: number; net: number; aicGrossAmount: number; sourceRows: ProcessedData[] }>();
    for (const row of userData) {
      const key = `${row.dateKey}||${row.model}||${row.costCenter ?? ''}`;
      const quantity = row.creditsUsed;
      const existing = agg.get(key);
      if (existing) {
        existing.credits += quantity;
        existing.gross += row.grossAmount ?? 0;
        existing.discount += row.discountAmount ?? 0;
        existing.net += row.netAmount ?? 0;
        existing.aicGrossAmount += row.aicGrossAmount ?? 0;
        existing.sourceRows.push(row);
      } else {
        agg.set(key, {
          date: row.dateKey,
          model: row.model,
          costCenter: row.costCenter,
          credits: quantity,
          gross: row.grossAmount ?? 0,
          discount: row.discountAmount ?? 0,
          net: row.netAmount ?? 0,
          aicGrossAmount: row.aicGrossAmount ?? 0,
          sourceRows: [row],
        });
      }
    }

    // Sort by date asc, then model
    const sorted = Array.from(agg.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.model !== b.model) return a.model.localeCompare(b.model);
      return (a.costCenter ?? '').localeCompare(b.costCenter ?? '');
    });

    // Count rows per date for rowSpan
    const dateSpan = new Map<string, number>();
    for (const r of sorted) dateSpan.set(r.date, (dateSpan.get(r.date) ?? 0) + 1);

    const seenDates = new Set<string>();
    return sorted.map((r) => {
      const isFirst = !seenDates.has(r.date);
      if (isFirst) seenDates.add(r.date);
      return {
        ...r,
        tokens: showTokens ? buildTokenArtifactsFromProcessedData(r.sourceRows).totals : undefined,
        isFirstInDate: isFirst,
        rowSpan: dateSpan.get(r.date) ?? 1,
      };
    });
  }, [hasBillingData, showTokens, userData]);

  const productCosts = useMemo(() => {
    if (!hasBillingData) return [];
    return aggregateProductCosts(userData);
  }, [hasBillingData, userData]);

  const dailyConsumption = useMemo(
    () => aggregateDailyConsumption(userData, analysisCtx?.aggregateProcessedData ?? processedData),
    [userData, analysisCtx?.aggregateProcessedData, processedData]
  );

  const costCenterCosts = useMemo((): UserCostCenterCost[] => {
    if (!hasBillingData) return [];

    const totals = new Map<string, UserCostCenterCost>();

    for (const row of userData) {
      if (!row.costCenter) {
        continue;
      }

      const entry = totals.get(row.costCenter) ?? {
        name: row.costCenter,
        quantity: 0,
        gross: 0,
        discount: 0,
        net: 0,
        aicGrossAmount: 0,
      };
      entry.quantity += row.creditsUsed;
      entry.gross += row.grossAmount ?? 0;
      entry.discount += row.discountAmount ?? 0;
      entry.net += row.netAmount ?? 0;
      entry.aicGrossAmount += row.aicGrossAmount ?? 0;
      totals.set(row.costCenter, entry);
    }

    return Array.from(totals.values()).sort(
      (left, right) => right.net - left.net || left.name.localeCompare(right.name)
    );
  }, [hasBillingData, userData]);

  const planInfo = {
    business: { name: 'Copilot Business', monthlyQuota: PRICING.BUSINESS_AI_CREDIT_QUOTA },
    enterprise: { name: 'Copilot Enterprise', monthlyQuota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA },
  };

  const userActualPlan = useMemo(() => {
    if (effectiveUserQuotaValue === 'unknown') {
      return 'unknown';
    }
    const tier = getQuotaTier(effectiveUserQuotaValue);
    if (tier === 'business') {
      return 'business';
    }
    if (tier === 'enterprise') {
      return 'enterprise';
    }

    return effectiveUserQuotaValue < 650 ? 'business' : 'enterprise';
  }, [effectiveUserQuotaValue]);

  const headerSummary = useMemo(
    () => {
      const summary = buildUserHeaderSummary(userData, quotaValue, hasBillingData);
      return {
        ...summary,
        organizations: summary.organizations.length > 0 ? summary.organizations : organization ? [organization] : [],
        costCenters: summary.costCenters.length > 0 ? summary.costCenters : costCenter ? [costCenter] : [],
      };
    },
    [userData, quotaValue, hasBillingData, organization, costCenter]
  );

  const handleCopyUser = async () => {
    try {
      await navigator.clipboard.writeText(user);
    } catch (error) {
      console.error('Failed to copy user to clipboard:', error);
    }
  };

  return (
    <div className="space-y-6">
      <UserDetailsHeader
        user={user}
        planName={
          userActualPlan === 'unknown'
            ? 'Unknown'
            : planInfo[userActualPlan as 'business' | 'enterprise'].name
        }
        summary={headerSummary}
        onBack={onBack}
        onCopyUser={handleCopyUser}
      />

      {/* Cost per Cost Center — standalone card */}
      {costCenterCosts.length > 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 className="text-sm font-medium text-[#1f2328]">Cost per Cost Center</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Cost per Cost Center">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Cost Center</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userQuantityColumnLabel}</th>
                  {showAicGross && (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">AI Credits Gross</th>
                  )}
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userCostLabels.gross}</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userCostLabels.discount}</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userCostLabels.net}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {costCenterCosts.map((costCenter) => (
                  <tr key={costCenter.name} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-[#1f2328]">{costCenter.name}</td>
                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">{costCenter.quantity.toFixed(2)}</td>
                    {showAicGross && (
                      <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">{formatCurrency(costCenter.aicGrossAmount)}</td>
                    )}
                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">{formatCurrency(costCenter.gross)}</td>
                    <td className="px-5 py-3 text-sm text-emerald-600 text-right font-mono">-{formatCurrency(costCenter.discount)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] text-right font-mono">{formatCurrency(costCenter.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userQuantityColumnLabel}</th>
                  {showAicGross && (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">AI Credits Gross</th>
                  )}
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userCostLabels.gross}</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userCostLabels.discount}</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{userCostLabels.net}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {productCosts.map((product) => (
                  <tr key={product.label} className="hover:bg-[#fcfdff] transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-[#1f2328]">{product.label}</td>
                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">{product.credits.toFixed(2)}</td>
                    {showAicGross && (
                      <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">{formatCurrency(product.aicGrossAmount)}</td>
                    )}
                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono">{formatCurrency(product.gross)}</td>
                    <td className="px-5 py-3 text-sm text-emerald-600 text-right font-mono">-{formatCurrency(product.discount)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] text-right font-mono">{formatCurrency(product.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dailyConsumption.length > 0 && (
        <section aria-labelledby="user-daily-consumption-title" className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden min-h-[20rem]">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 id="user-daily-consumption-title" className="text-sm font-medium text-[#1f2328]">Daily Consumption</h3>
            <p className="text-xs text-[#636c76] mt-1">Included and additional usage by day in USD</p>
          </div>
          <div className="p-5">
            <div className="h-72 sm:h-96 2xl:h-[28rem] w-full">
              <DailyConsumptionChart data={dailyConsumption} />
            </div>
          </div>
        </section>
      )}

      {/* Daily Model Usage chart — standalone card */}
      <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
        <h3 className="text-sm font-medium text-[#1f2328] mb-1">Daily Model Usage</h3>
        <p className="text-xs text-[#636c76] mb-4">
          Daily {userQuantityColumnLabel} by model
        </p>

        {userDailyData.length > 0 ? (
          <>
            <div className="h-72 sm:h-96 2xl:h-[28rem] w-full">
              <UserDailyStackedChart
                data={userDailyData}
                models={userModels}
                modelColors={modelColors}
                tooltip={<UserDailyUsageTooltip valueUnitLabel={chartValueUnitLabel} />}
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

      <UserConsumptionMetrics key={user} rows={userData} tokensAvailable={analysisCtx?.tokenArtifacts !== null} />

      {/* Daily Model Usage Breakdown table — standalone card */}
      {dailyBreakdownRows.length > 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 className="text-sm font-medium text-[#1f2328]">Daily Model Usage Breakdown</h3>
            {showTokens && (
              <p className="text-xs text-[#636c76] mt-1">
                Token counts: — means not reported. Partial totals include only rows with reported counts.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Daily Model Usage Breakdown">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-5 py-3 w-28 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Date</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Model</th>
                  {hasUserCostCenters && (
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Cost Center</th>
                  )}
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">{userQuantityColumnLabel}</th>
                  {showTokens && TOKEN_COLUMNS.map(({ field, label }) => (
                    <th key={field} scope="col" className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                  {showAicGross && (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">AI Credits Gross</th>
                  )}
                  {hasBillingData && (
                    <>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">{userCostLabels.gross}</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">{userCostLabels.discountSummary}</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">{userCostLabels.netSummary}</th>
                    </>
                  )}
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
                    {hasUserCostCenters && (
                      <td className="px-5 py-3 text-sm text-[#636c76] whitespace-nowrap">{row.costCenter ?? '—'}</td>
                    )}
                    <td className="px-5 py-3 text-sm font-mono text-[#1f2328] text-right">{row.credits.toFixed(2)}</td>
                    {showTokens && TOKEN_COLUMNS.map(({ field }) => (
                        <td key={field} className="px-5 py-3 text-sm font-mono tabular-nums text-[#636c76] text-right whitespace-nowrap">
                          <TokenValue totals={row.tokens} field={field} />
                        </td>
                    ))}
                    {showAicGross && (
                      <td className="px-5 py-3 text-sm font-mono text-[#636c76] text-right">{formatCurrency(row.aicGrossAmount)}</td>
                    )}
                    {hasBillingData && (
                      <>
                        <td className="px-5 py-3 text-sm font-mono text-[#636c76] text-right">{formatCurrency(row.gross)}</td>
                        <td className="px-5 py-3 text-sm font-mono text-emerald-600 text-right">-{formatCurrency(row.discount)}</td>
                        <td className="px-5 py-3 text-sm font-mono font-semibold text-[#1f2328] text-right">{formatCurrency(row.net)}</td>
                      </>
                    )}
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
