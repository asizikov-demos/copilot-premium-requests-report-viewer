'use client';

import React, { useContext, useMemo } from 'react';
import { Banner } from '@primer/react';

import { UserDetailsHeader } from '@/components/UserDetailsHeader';
import { DetailStreamStatus } from '@/components/DetailStreamStatus';
import { useDetailStream, type DetailResult } from '@/hooks/useDetailStream';
import { UserConsumptionMetrics } from '@/components/UserConsumptionMetrics';
import { TOKEN_COLUMNS } from '@/components/TokenValue';
import { DailyConsumptionChart } from '@/components/charts/DailyConsumptionChart';
import { PRICING } from '@/constants/pricing';
import { AnalysisContext } from '@/context/AnalysisContext';
import { UserDailyStackedChart } from '@/components/charts/UserDailyStackedChart';
import { utcDateLabelFormatter } from '@/components/charts/chartTooltipStyles';
import type { UserSummary } from '@/utils/analytics';
import { getQuotaTier, isKnownQuotaValue } from '@/utils/analytics/quota';
import {
  getUserQuota,
} from '@/utils/ingestion';
import { generateModelColors } from '@/utils/modelColors';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { formatCurrency } from '@/utils/formatters';
import { summarizeUserHeader } from '@/utils/userHeaderSummary';
import { selectDetailTimeline } from '@/utils/ingestion/DetailAggregator';

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

const TOKEN_BREAKDOWN_ORDER = ['inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens'];
const TOKEN_BREAKDOWN_COLUMNS = [...TOKEN_COLUMNS].sort(
  (left, right) => TOKEN_BREAKDOWN_ORDER.indexOf(left.field) - TOKEN_BREAKDOWN_ORDER.indexOf(right.field)
);

export interface UserDetailsViewProps {
  user: string;
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
      <div className="bg-(--bgColor-default) p-3 border border-(--borderColor-default) rounded-md shadow-(--shadow-floating-small)">
        <p className="font-medium text-(--fgColor-default) mb-2">{formattedDate}</p>

        {modelData.length > 0 ? (
          <div className="mb-2">
            <p className="text-xs font-medium text-(--fgColor-muted) mb-1">Daily Usage</p>
            {modelData.map((entry: TooltipEntry, entryIndex: number) => (
              <p key={entryIndex} className="text-xs ml-2" style={{ color: entry.color }}>
                {entry.dataKey}: {entry.value.toFixed(1)} {valueUnitLabel}
              </p>
            ))}
            <p className="text-xs font-semibold text-(--fgColor-default) ml-2 mt-1">
              Total: {dailyTotal.toFixed(1)} {valueUnitLabel}
            </p>
          </div>
        ) : (
          <p className="text-xs text-(--fgColor-muted) mb-2">No {valueUnitLabel}</p>
        )}
      </div>
    );
  }

  return null;
}

export function UserDetailsView({
  ...props
}: UserDetailsViewProps) {
  const { data, error, progress, months } = useDetailStream({ user: props.user });
  if (!data) return <DetailStreamStatus error={error} progress={progress} onBack={props.onBack} />;
  return <UserDetailsContent {...props} data={data} months={months} />;
}

export function UserDetailsContent({
  user,
  userQuotaValue,
  userAggregate,
  onBack,
  data,
  months,
}: UserDetailsViewProps & { data: DetailResult; months: string[] }) {
  const analysisCtx = useContext(AnalysisContext);
  const { details, tokens } = data;
  const usageArtifacts = analysisCtx?.usageArtifacts;
  const quotaArtifacts = analysisCtx?.quotaArtifacts;

  const artifactUserQuota = quotaArtifacts ? getUserQuota(quotaArtifacts, user) : undefined;
  const effectiveUserQuotaValue = artifactUserQuota !== undefined ? artifactUserQuota : userQuotaValue;

  const hasBillingData = details.hasBillingData;
  const userQuantityColumnLabel = 'AI Credits';
  const chartValueUnitLabel = 'AI Credits';
  const userCostLabels = useMemo(() => getBillingCostLabels(), []);

  const { userDailyData, dailyConsumption } = useMemo(
    () => selectDetailTimeline(details, months), [details, months]);

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

    return { organization: undefined, costCenter: undefined };
  }, [effectiveUserAggregate]);

  const userModels = details.models;
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

  const showAicGross = false;
  const showTokens = analysisCtx?.tokenArtifacts !== null && tokens.hasAnyTokenData;
  const userTokenTotals = showTokens ? tokens.totals : null;
  const totalReportedTokens = userTokenTotals
    ? TOKEN_BREAKDOWN_COLUMNS.reduce((total, { field }) => total + (userTokenTotals[field] ?? 0), 0)
    : 0;
  const hasUserCostCenters = details.header.costCenters.length > 0;
  const dailyBreakdownRows = hasBillingData || showTokens ? details.dailyModels : [];
  const productCosts = hasBillingData ? details.productCosts : [];
  const costCenterCosts = hasBillingData ? details.costCenterCosts : [];

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
      const summary = summarizeUserHeader(details.header, quotaValue, hasBillingData);
      return {
        ...summary,
        organizations: summary.organizations.length > 0 ? summary.organizations : organization ? [organization] : [],
        costCenters: summary.costCenters.length > 0 ? summary.costCenters : costCenter ? [costCenter] : [],
      };
    },
    [details.header, quotaValue, hasBillingData, organization, costCenter]
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
      {data.warnings?.length ? <Banner variant="warning" title="Report warnings" description={data.warnings.join('; ')} /> : null}
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

      {userTokenTotals && (
        <section
          aria-labelledby="token-usage-by-type-title"
          className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 id="token-usage-by-type-title" className="text-sm font-medium text-(--fgColor-default)">
              Token usage by type
            </h3>
            <p className="text-xs text-(--fgColor-muted) mt-1">
              Reported token counts only.
            </p>
          </div>
          <div className="p-5">
            <div
              role="img"
              aria-label={`Token volume distribution across ${totalReportedTokens.toLocaleString()} reported tokens`}
              className="flex h-2 w-full overflow-hidden rounded-sm bg-(--bgColor-muted)"
            >
              {TOKEN_BREAKDOWN_COLUMNS.map(({ field, color }) => {
                const count = userTokenTotals[field] ?? 0;
                const width = totalReportedTokens > 0 ? (count / totalReportedTokens) * 100 : 0;
                return (
                  <span
                    key={field}
                    aria-hidden="true"
                    className="h-full"
                    style={{ width: `${width}%`, backgroundColor: color }}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {TOKEN_BREAKDOWN_COLUMNS.map(({ field, label, color }) => {
                const count = userTokenTotals[field];
                return (
                  <div key={field} className="inline-flex items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-(--fgColor-muted)">{label.replace(/ Tokens$/, '')}</span>
                    <span className="font-mono tabular-nums text-(--fgColor-default)">
                      {count === undefined ? '—' : count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Cost per Cost Center — standalone card */}
      {costCenterCosts.length > 0 && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 className="text-sm font-medium text-(--fgColor-default)">Cost per Cost Center</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Cost per Cost Center">
              <thead>
                <tr className="border-b border-(--borderColor-default)">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">Cost Center</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userQuantityColumnLabel}</th>
                  {showAicGross && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">AI Credits Gross</th>
                  )}
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userCostLabels.gross}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userCostLabels.discount}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userCostLabels.net}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--borderColor-default)">
                {costCenterCosts.map((costCenter) => (
                  <tr key={costCenter.name} className="hover:bg-(--bgColor-muted) transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-(--fgColor-default)">{costCenter.name}</td>
                    <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono">{costCenter.quantity.toFixed(2)}</td>
                    {showAicGross && (
                      <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono">{formatCurrency(costCenter.aicGrossAmount)}</td>
                    )}
                    <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono">{formatCurrency(costCenter.gross)}</td>
                    <td className="px-5 py-3 text-sm text-(--fgColor-success) text-right font-mono">-{formatCurrency(costCenter.discount)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-(--fgColor-default) text-right font-mono">{formatCurrency(costCenter.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost per Product — standalone card */}
      {productCosts.length > 0 && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 className="text-sm font-medium text-(--fgColor-default)">Cost per Product</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-(--borderColor-default)">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">Product</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userQuantityColumnLabel}</th>
                  {showAicGross && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">AI Credits Gross</th>
                  )}
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userCostLabels.gross}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userCostLabels.discount}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{userCostLabels.net}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--borderColor-default)">
                {productCosts.map((product) => (
                  <tr key={product.label} className="hover:bg-(--bgColor-muted) transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-(--fgColor-default)">{product.label}</td>
                    <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono">{product.credits.toFixed(2)}</td>
                    {showAicGross && (
                      <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono">{formatCurrency(product.aicGrossAmount)}</td>
                    )}
                    <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono">{formatCurrency(product.gross)}</td>
                    <td className="px-5 py-3 text-sm text-(--fgColor-success) text-right font-mono">-{formatCurrency(product.discount)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-(--fgColor-default) text-right font-mono">{formatCurrency(product.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dailyConsumption.length > 0 && (
        <section aria-labelledby="user-daily-consumption-title" className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden min-h-[20rem]">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 id="user-daily-consumption-title" className="text-sm font-medium text-(--fgColor-default)">Daily Consumption</h3>
            <p className="text-xs text-(--fgColor-muted) mt-1">Included and additional usage by day in USD</p>
          </div>
          <div className="p-5">
            <div className="h-72 sm:h-96 2xl:h-[28rem] w-full">
              <DailyConsumptionChart data={dailyConsumption} />
            </div>
          </div>
        </section>
      )}

      {/* Daily Model Usage chart — standalone card */}
      <section aria-labelledby="daily-model-usage-title" className="overflow-hidden rounded-md border border-(--borderColor-default) bg-(--bgColor-default)">
        <div className="border-b border-(--borderColor-default) px-5 py-4">
          <h3 id="daily-model-usage-title" className="text-sm font-medium text-(--fgColor-default)">Daily Model Usage</h3>
          <p className="mt-1 text-xs text-(--fgColor-muted)">
            Daily {userQuantityColumnLabel} by model
          </p>
        </div>

        <div className="p-5">
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
                <div className="border-t border-(--borderColor-default) pt-4 mt-4">
                  <h4 className="text-xs font-semibold text-(--fgColor-muted) uppercase tracking-[0.05em] mb-2">Models Used</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {sortedModels.map((model) => (
                      <div key={model} className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: modelColors[model] }}
                        />
                        <span className="text-xs text-(--fgColor-muted) truncate max-w-[140px]" title={model}>
                          {model.length > 18 ? `${model.substring(0, 18)}...` : model}
                        </span>
                        <span className="text-xs text-(--fgColor-muted) font-mono">
                          {modelUsageTotals[model]?.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-(--fgColor-muted) text-sm">
              No data available
            </div>
          )}
        </div>
      </section>

      <UserConsumptionMetrics
        key={user}
        metrics={{ ...details.consumption, tokens: analysisCtx?.tokenArtifacts !== null ? tokens : undefined }}
        months={months}
      />

      {/* Daily Model Usage Breakdown table — standalone card */}
      {dailyBreakdownRows.length > 0 && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 className="text-sm font-medium text-(--fgColor-default)">Daily Model Usage Breakdown</h3>
            {showTokens && (
              <p className="text-xs text-(--fgColor-muted) mt-1">
                Cache success rate = cache read ÷ (input + cache read + cache write). Partial rates use rows with all three counts reported; — means no rows reported all counts or their combined total is zero.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Daily Model Usage Breakdown">
              <thead>
                <tr className="border-b border-(--borderColor-default)">
                  <th className="px-5 py-3 w-28 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">Model</th>
                  {hasUserCostCenters && (
                    <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">Cost Center</th>
                  )}
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">{userQuantityColumnLabel}</th>
                  {showTokens && (
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">
                      Cache Success Rate
                    </th>
                  )}
                  {showAicGross && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">AI Credits Gross</th>
                  )}
                  {hasBillingData && (
                    <>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">{userCostLabels.gross}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">{userCostLabels.discountSummary}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">{userCostLabels.netSummary}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-(--borderColor-default)">
                {dailyBreakdownRows.map((row, idx) => (
                  <tr key={`${row.date}-${row.model}-${idx}`} className="hover:bg-(--bgColor-muted) transition-colors">
                    {row.isFirstInDate ? (
                      <td
                        rowSpan={row.rowSpan}
                        className="px-5 py-3 w-28 text-sm font-medium text-(--fgColor-default) whitespace-nowrap align-top"
                      >
                        {row.date}
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-sm text-(--fgColor-muted)">- {row.model}</td>
                    {hasUserCostCenters && (
                      <td className="px-5 py-3 text-sm text-(--fgColor-muted) whitespace-nowrap">{row.costCenter ?? '—'}</td>
                    )}
                    <td className="px-5 py-3 text-sm font-mono text-(--fgColor-default) text-right">{row.credits.toFixed(2)}</td>
                    {showTokens && (
                      <td className="px-5 py-3 text-sm font-mono tabular-nums text-(--fgColor-muted) text-right whitespace-nowrap">
                        {row.cacheSuccessRate ? (
                          <>
                            {row.cacheSuccessRate.percent.toFixed(1)}%
                            {row.cacheSuccessRate.reportedRows < row.cacheSuccessRate.totalRows && (
                              <span
                                className="ml-1 text-xs"
                                title={`${row.cacheSuccessRate.reportedRows} of ${row.cacheSuccessRate.totalRows} rows reported input, cache read, and cache write tokens`}
                              >
                                (partial)
                              </span>
                            )}
                          </>
                        ) : (
                          <span aria-label="Not reported">—</span>
                        )}
                      </td>
                    )}
                    {showAicGross && (
                      <td className="px-5 py-3 text-sm font-mono text-(--fgColor-muted) text-right">{formatCurrency(row.aicGrossAmount)}</td>
                    )}
                    {hasBillingData && (
                      <>
                        <td className="px-5 py-3 text-sm font-mono text-(--fgColor-muted) text-right">{formatCurrency(row.gross)}</td>
                        <td className="px-5 py-3 text-sm font-mono text-(--fgColor-success) text-right">-{formatCurrency(row.discount)}</td>
                        <td className="px-5 py-3 text-sm font-mono font-semibold text-(--fgColor-default) text-right">{formatCurrency(row.net)}</td>
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
