'use client';

import React, { useEffect, useMemo } from 'react';
import {
  AgentIcon,
  AiModelIcon,
  CreditCardIcon,
  GraphIcon,
  type Icon,
  LightBulbIcon,
  OrganizationIcon,
  PeopleIcon,
  SparkleFillIcon,
} from '@primer/octicons-react';

import { PRICING } from '@/constants/pricing';
import { AnalysisProvider, useAnalysisContext } from '@/context/AnalysisContext';
import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';
import { aggregateAutoModeSavings } from '@/utils/autoModeSavings';
import { aggregateDailyConsumption } from '@/utils/dailyConsumption';
import { formatCurrency } from '@/utils/formatters';
import { getModelColor } from '@/utils/modelColors';
import { aggregateProductCosts } from '@/utils/productCosts';

import { AiUsageOverview } from './AiUsageOverview';
import { CodingAgentOverview } from './CodingAgentOverview';
import { CostCentersOverview } from './CostCentersOverview';
import { DailyConsumptionChart } from './charts/DailyConsumptionChart';
import { InsightsOverview } from './InsightsOverview';
import { ModelCreditsTreemap } from './charts/ModelCreditsTreemap';
import { ModelUsageTrendsOverview } from './ModelUsageTrendsOverview';
import { OrganizationsOverview } from './OrganizationsOverview';
import { UsersOverview } from './UsersOverview';

interface DataAnalysisProps {
  ingestionResult: import('@/utils/ingestion').IngestionResult;
  filename: string;
  onReset: () => void;
}

type NavigationItem = {
  key: 'overview' | 'users' | 'costCenters' | 'organizations' | 'codingAgent' | 'insights' | 'modelTrends' | 'aiUsage';
  label: string;
  icon: Icon;
};

const COST_CENTERS_NAV_ITEM: NavigationItem = { key: 'costCenters', label: 'Cost Centers', icon: CreditCardIcon };
const ORGANIZATIONS_NAV_ITEM: NavigationItem = { key: 'organizations', label: 'Organizations', icon: OrganizationIcon };

const NAV_ITEMS: NavigationItem[] = [
  { key: 'overview', label: 'Overview', icon: GraphIcon },
  { key: 'users', label: 'Users', icon: PeopleIcon },
  { key: 'codingAgent', label: 'Agent Adoption', icon: AgentIcon },
  { key: 'insights', label: 'Insights', icon: LightBulbIcon },
  { key: 'modelTrends', label: 'Models', icon: AiModelIcon },
];

const AI_USAGE_NAV_ITEM: NavigationItem = { key: 'aiUsage', label: 'AI Usage', icon: SparkleFillIcon };

function DataAnalysisInner() {
  const {
    view,
    setView,
    analysis,
    userData,
    dailyCumulativeData,
    codingAgentAnalysis,
    codeReviewAnalysis,
    processedData,
    aggregateProcessedData,
    baseProcessed,
    availableMonths,
    hasMultipleMonthsData,
    selectedMonths,
    setSelectedMonths,
    planInfo,
    filename,
    quotaArtifacts,
    usageArtifacts,
    featureUsageArtifacts,
    billingArtifacts
  } = useAnalysisContext();

  const hasCostCenters = useMemo(() => {
    return baseProcessed.some((row) => row.costCenter);
  }, [baseProcessed]);

  const hasOrganizations = useMemo(() => {
    return baseProcessed.some((row) => row.organization);
  }, [baseProcessed]);

  const aicMetricsAvailable = billingArtifacts?.hasAnyAicData === true;
  const { billingRows, quantityColumnLabel, costLabels } =
    useUsageBasedBillingScope(aggregateProcessedData, billingArtifacts);
  const unitCostLabel = `1 AI Credit = ${formatCurrency(PRICING.AI_CREDIT_USD_VALUE)}`;
  const monthlyQuotaDisplay = useMemo(() => {
    if (analysis.quotaBreakdown.mixed) {
      return 'Mixed';
    }

    const distinctQuotas = Array.from(quotaArtifacts.distinctQuotas);
    if (distinctQuotas.length === 1) {
      return distinctQuotas[0].toLocaleString();
    }

    return 'Unknown';
  }, [analysis.quotaBreakdown.mixed, quotaArtifacts.distinctQuotas]);

  const navItems = useMemo(() => {
    const items = [...NAV_ITEMS];
    let insertIdx = 2; // After 'users'
    if (hasCostCenters) {
      items.splice(insertIdx, 0, COST_CENTERS_NAV_ITEM);
      insertIdx++;
    }
    if (hasOrganizations) {
      items.splice(insertIdx, 0, ORGANIZATIONS_NAV_ITEM);
    }
    if (aicMetricsAvailable) {
      items.push(AI_USAGE_NAV_ITEM);
    }
    return items;
  }, [aicMetricsAvailable, hasCostCenters, hasOrganizations]);

  useEffect(() => {
    if (!hasCostCenters && view === 'costCenters') {
      setView('overview');
    }
    if (!hasOrganizations && view === 'organizations') {
      setView('overview');
    }
    if (!aicMetricsAvailable && view === 'aiUsage') {
      setView('overview');
    }
  }, [aicMetricsAvailable, hasCostCenters, hasOrganizations, setView, view]);

  const costMetricsAvailable = billingArtifacts?.hasAnyBillingData === true;
  const aggregatedCosts = costMetricsAvailable && billingArtifacts ? billingArtifacts.totals : null;

  const modelRows = useMemo(() => {
    const byModel = new Map<string, number>();
    for (const row of aggregateProcessedData) {
      byModel.set(row.model, (byModel.get(row.model) ?? 0) + row.creditsUsed);
    }
    return [...byModel.entries()].map(([model, credits]) => {
      const totals = billingArtifacts?.billingByModel.get(model);
      return {
        model,
        credits,
        gross: totals?.gross ?? 0,
        discount: totals?.discount ?? 0,
        net: totals?.net ?? 0,
      };
    }).sort((left, right) => right.credits - left.credits);
  }, [aggregateProcessedData, billingArtifacts]);

  const hasModelCosts = modelRows.some(
    (row) => row.gross > 0 || row.discount > 0 || row.net > 0
  );
  const showModelQuantity = true;
  const modelChartData = useMemo(() => (
    modelRows.map((item) => ({
      fullModel: item.model,
      credits: item.credits,
    }))
  ), [modelRows]);
  const modelChartTotal = modelRows.reduce((sum, model) => sum + model.credits, 0);
  const modelChartTitle = 'AI Credits by Model';
  const modelChartUnitLabel = 'AI Credits';
  const modelChartTotalDisplay = modelChartTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const productCosts = useMemo(() => aggregateProductCosts(billingRows), [billingRows]);
  const dailyConsumption = useMemo(
    () => aggregateDailyConsumption(billingRows, aggregateProcessedData),
    [billingRows, aggregateProcessedData]
  );
  const showProductCosts = costMetricsAvailable;
  const autoModeSavingsRows = useMemo(
    () => aggregateAutoModeSavings(billingRows),
    [billingRows]
  );
  const autoModeSavingsTotal = useMemo(() => {
    return autoModeSavingsRows.reduce(
      (total, row) => ({
        quantity: total.quantity + row.quantity,
        costBeforeAuto: total.costBeforeAuto + row.costBeforeAuto,
        savings: total.savings + row.savings,
      }),
      { quantity: 0, costBeforeAuto: 0, savings: 0 }
    );
  }, [autoModeSavingsRows]);

  return (
    <div className="w-full">
      {/* Info Bar — attached to header */}
      <div className="-mx-6 -mt-8 mb-6 px-6 py-3 bg-(--bgColor-muted) border-b border-(--borderColor-default)">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--fgColor-muted)">
          <span>File: <span className="font-semibold text-(--fgColor-default)">{filename}</span></span>
          <span className="hidden sm:inline text-(--fgColor-disabled)">|</span>
          <span>Report window: <span className="font-semibold text-(--fgColor-default)">{analysis.timeFrame.start} to {analysis.timeFrame.end}</span></span>
          <span className="hidden sm:inline text-(--fgColor-disabled)">|</span>
          <span>Total rows: <span className="font-semibold text-(--fgColor-default)">{aggregateProcessedData.length.toLocaleString()}</span></span>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden mb-6">
        <nav aria-label="Report sections" className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => setView(item.key)}
              aria-current={view === item.key ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                view === item.key
                  ? 'bg-(--bgColor-default) text-(--fgColor-default) border-b-2 border-(--underlineNav-borderColor-active) font-semibold'
                  : 'bg-(--bgColor-default) text-(--fgColor-muted) hover:bg-(--control-transparent-bgColor-hover) border border-(--borderColor-default) hover:border-(--borderColor-default)'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Desktop Layout: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md sticky top-24 opacity-0 animate-slide-in-right" style={{ animationDelay: '100ms' }}>
            {/* Navigation */}
            <nav aria-label="Report sections" className="p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setView(item.key)}
                  aria-current={view === item.key ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                    view === item.key
                      ? 'bg-(--bgColor-muted) text-(--fgColor-default) font-semibold'
                      : 'text-(--fgColor-muted) hover:bg-(--control-transparent-bgColor-hover) hover:text-(--fgColor-default)'
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Billing Period Filter */}
            {hasMultipleMonthsData && (
              <div className="border-t border-(--borderColor-default) p-4">
                <fieldset aria-describedby="billing-period-hint">
                  <legend className="block text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider mb-2">
                    Billing Period
                  </legend>
                  <div className="space-y-1">
                    {availableMonths.map(month => (
                      <label
                        key={month.value}
                        className="flex items-center gap-2 px-1 py-1 text-sm text-(--fgColor-default) rounded-md cursor-pointer hover:bg-(--control-transparent-bgColor-hover)"
                      >
                        <input
                          type="checkbox"
                          value={month.value}
                          checked={selectedMonths.includes(month.value)}
                          onChange={(e) => {
                            const { checked, value } = e.target;
                            setSelectedMonths(availableMonths
                              .map(option => option.value)
                              .filter(option => option === value ? checked : selectedMonths.includes(option)));
                          }}
                          className="size-4 accent-(--bgColor-accent-emphasis)"
                        />
                        {month.label}
                      </label>
                    ))}
                  </div>
                  <p id="billing-period-hint" className="mt-2 text-xs text-(--fgColor-muted)">
                    Leave all unchecked to include every month
                  </p>
                </fieldset>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {view === 'users' ? (
            <UsersOverview
              userData={userData}
              processedData={processedData}
              dailyCumulativeData={dailyCumulativeData}
              quotaArtifacts={quotaArtifacts}
              usageArtifacts={usageArtifacts}
              billingArtifacts={billingArtifacts}
            />
          ) : view === 'costCenters' ? (
            <CostCentersOverview />
          ) : view === 'organizations' ? (
            <OrganizationsOverview />
          ) : view === 'codingAgent' ? (
            <CodingAgentOverview
              codingAgentUsers={codingAgentAnalysis.users}
              totalUniqueUsers={codingAgentAnalysis.totalUniqueUsers}
              adoptionRate={codingAgentAnalysis.adoptionRate}
              codeReviewAnalysis={codeReviewAnalysis}
            />
          ) : view === 'insights' ? (
            <InsightsOverview
              userData={userData}
              processedData={processedData}
              featureUsageArtifacts={featureUsageArtifacts}
            />
          ) : view === 'modelTrends' ? (
            <ModelUsageTrendsOverview />
          ) : view === 'aiUsage' ? (
            <AiUsageOverview />
          ) : (
            /* Overview — chart + model table */
            <div className="space-y-6">
              {/* Current Billing + Licenses row */}
              {costMetricsAvailable && aggregatedCosts && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                  {/* Current Billing */}
                  <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md p-5">
                    <p className="text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider text-center mb-3">Current Billing</p>
                    <p className="text-3xl font-bold text-(--fgColor-default) text-center">
                      {formatCurrency(aggregatedCosts.net)}
                    </p>
                    <p className="text-sm text-(--fgColor-muted) text-center mt-1">
                      {aggregateProcessedData.reduce((sum, r) => sum + r.creditsUsed, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AI Credits
                    </p>
                    <p className="text-xs text-(--fgColor-muted) text-center mt-0.5">
                      {unitCostLabel}
                    </p>
                    <div className="mt-4 pt-4 border-t border-(--borderColor-default) space-y-2 text-sm" aria-label="billing-summary">
                      <div className="flex justify-between">
                        <span className="text-(--fgColor-muted)">Gross cost</span>
                        <span className="font-mono font-medium text-(--fgColor-default)">
                          {formatCurrency(aggregatedCosts.gross)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-(--fgColor-muted)">{costLabels.discountSummary}</span>
                        <span className="font-mono font-medium text-(--fgColor-default)">
                          &minus;{formatCurrency(aggregatedCosts.discount)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 mt-2 border-t-2 border-(--borderColor-default)">
                        <span className="text-(--fgColor-default) font-bold">{costLabels.netSummary}</span>
                        <span className="font-mono font-bold text-(--fgColor-default)">
                          {formatCurrency(aggregatedCosts.net)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Licenses */}
                  <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md p-5">
                    <p className="text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider text-center mb-3">Licenses</p>
                    <p className="text-3xl font-bold text-(--fgColor-default) text-center">
                      {analysis.totalUniqueUsers}
                    </p>
                    <p className="text-sm text-(--fgColor-muted) text-center mt-1">total users</p>
                    <div className="mt-4 pt-4 border-t border-(--borderColor-default) space-y-2 text-sm">
                      {analysis.quotaBreakdown.enterprise.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-(--fgColor-muted)">Copilot Enterprise</span>
                          <span className="font-mono font-medium text-(--fgColor-default)">{analysis.quotaBreakdown.enterprise.length}</span>
                        </div>
                      )}
                      {analysis.quotaBreakdown.business.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-(--fgColor-muted)">Copilot Business</span>
                          <span className="font-mono font-medium text-(--fgColor-default)">{analysis.quotaBreakdown.business.length}</span>
                        </div>
                      )}
                      {analysis.quotaBreakdown.unknown.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-(--fgColor-muted)">Unknown</span>
                          <span className="font-mono font-medium text-(--fgColor-default)">{analysis.quotaBreakdown.unknown.length}</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Cost per Product */}
              {productCosts.length > 0 && (
                <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  <div className="px-6 py-4 border-b border-(--borderColor-default) bg-(--bgColor-muted)">
                    <h3 className="text-lg font-semibold text-(--fgColor-default)">Cost per Product</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-(--borderColor-default)">
                          <th className="px-6 py-3 text-left text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{quantityColumnLabel}</th>
                          {showProductCosts && (
                            <>
                              <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Gross</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.discount}</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.net}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--borderColor-default)">
                        {productCosts.map((product) => (
                          <tr key={product.label} className="hover:bg-(--bgColor-muted) transition-colors duration-150">
                            <td className="px-6 py-3.5 text-sm font-medium text-(--fgColor-default)">{product.label}</td>
                            <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">
                              {product.credits.toFixed(2)}
                            </td>
                            {showProductCosts && (
                              <>
                                <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">{formatCurrency(product.gross)}</td>
                                <td className="px-6 py-3.5 text-sm text-(--fgColor-success) text-right font-mono">-{formatCurrency(product.discount)}</td>
                                <td className="px-6 py-3.5 text-sm font-semibold text-(--fgColor-default) text-right font-mono">{formatCurrency(product.net)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {costMetricsAvailable && dailyConsumption.length > 0 && (
                <section aria-labelledby="daily-consumption-title" className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden min-h-[20rem]">
                  <div className="px-6 py-4 border-b border-(--borderColor-default) bg-(--bgColor-muted)">
                    <h3 id="daily-consumption-title" className="text-lg font-semibold text-(--fgColor-default)">Daily Consumption</h3>
                    <p className="text-sm text-(--fgColor-muted) mt-0.5">Included and additional usage by day in USD</p>
                  </div>
                  <div className="p-5">
                    <div className="h-72 sm:h-96 2xl:h-[28rem] w-full">
                      <DailyConsumptionChart data={dailyConsumption} />
                    </div>
                  </div>
                </section>
              )}

              {autoModeSavingsRows.length > 0 && costMetricsAvailable && (
                <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                  <div className="px-6 py-4 border-b border-(--borderColor-default) bg-(--bgColor-muted)">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-(--fgColor-default)">Auto Mode Savings</h3>
                        <p className="text-sm text-(--fgColor-muted) mt-0.5">
                          Savings compare billed cost with the cost before Auto Mode&apos;s {PRICING.AUTO_MODE_DISCOUNT_RATE * 100}% AI Credits discount.
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-(--fgColor-success)">
                        {formatCurrency(autoModeSavingsTotal.savings)} saved
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-(--borderColor-default)">
                          <th className="px-6 py-3 text-left text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Model</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{quantityColumnLabel}</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Cost Before Auto</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Savings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--borderColor-default)">
                        {autoModeSavingsRows.map((item) => (
                          <tr key={item.model} className="hover:bg-(--bgColor-muted) transition-colors duration-150">
                            <td className="px-6 py-3.5 text-sm font-medium text-(--fgColor-default)">{item.model}</td>
                            <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">{item.quantity.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">{formatCurrency(item.costBeforeAuto)}</td>
                            <td className="px-6 py-3.5 text-sm font-semibold text-(--fgColor-success) text-right font-mono">{formatCurrency(item.savings)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-(--borderColor-default) bg-(--bgColor-muted)">
                          <td className="px-6 py-3.5 text-sm font-bold text-(--fgColor-default)">Total</td>
                          <td className="px-6 py-3.5 text-sm font-bold text-(--fgColor-default) text-right font-mono">{autoModeSavingsTotal.quantity.toFixed(2)}</td>
                          <td className="px-6 py-3.5 text-sm font-bold text-(--fgColor-default) text-right font-mono">{formatCurrency(autoModeSavingsTotal.costBeforeAuto)}</td>
                          <td className="px-6 py-3.5 text-sm font-bold text-(--fgColor-success) text-right font-mono">{formatCurrency(autoModeSavingsTotal.savings)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md p-6 opacity-0 animate-scale-in" style={{ animationDelay: '200ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-(--fgColor-default)">{modelChartTitle}</h3>
                  <span className="text-xs text-(--fgColor-muted) font-medium">Total: {modelChartTotalDisplay} {modelChartUnitLabel}</span>
                </div>
                <p className="text-xs text-(--fgColor-muted) mb-6">
                  Tile area represents each model&apos;s share of AI Credits. Hover or focus a tile for exact usage.
                </p>
                <ModelCreditsTreemap data={modelChartData} />
              </div>

              <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="px-6 py-4 border-b border-(--borderColor-default) bg-(--bgColor-muted)">
                  <h3 className="text-lg font-semibold text-(--fgColor-default)">Model Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-(--borderColor-default)">
                        <th className="px-6 py-3 text-left text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Model</th>
                        {showModelQuantity && (
                          <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{quantityColumnLabel}</th>
                        )}
                        {hasModelCosts && (
                          <>
                            <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.gross}</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.discount}</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.net}</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--borderColor-default)">
                      {modelRows.map((item, index) => {
                        return (
                          <tr key={index} className="hover:bg-(--bgColor-muted) transition-colors duration-150">
                            <td className="px-6 py-3.5 text-sm font-medium text-(--fgColor-default)">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getModelColor(item.model) }}></div>
                                {item.model}
                              </div>
                            </td>
                            {showModelQuantity && (
                              <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">
                                {item.credits.toFixed(2)}
                              </td>
                            )}
                            {hasModelCosts && (
                              <>
                                <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">
                                  {formatCurrency(item.gross)}
                                </td>
                                <td className="px-6 py-3.5 text-sm text-(--fgColor-success) text-right font-mono">
                                  -{formatCurrency(item.discount)}
                                </td>
                                <td className="px-6 py-3.5 text-sm font-semibold text-(--fgColor-default) text-right font-mono">
                                  {formatCurrency(item.net)}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Summary Panel */}
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md p-5 sticky top-24 opacity-0 animate-slide-in-right" style={{ animationDelay: '250ms' }}>
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Summary</h3>

              <div className="flex items-center justify-between p-3 bg-(--bgColor-muted) rounded-md border border-(--borderColor-default)">
                <span className="text-xs font-medium text-(--fgColor-muted)">Monthly Quota</span>
                <span className="text-sm font-bold text-(--fgColor-default)">
                  {monthlyQuotaDisplay}
                </span>
              </div>

              {analysis.quotaBreakdown.suggestedPlan && !analysis.quotaBreakdown.mixed && (
                <div className="p-3 rounded-md border border-(--borderColor-accent-muted) bg-(--bgColor-accent-muted) text-(--fgColor-default)">
                  <p className="text-xs">
                    Auto-selected <span className="font-semibold">{planInfo[analysis.quotaBreakdown.suggestedPlan].name}</span>
                  </p>
                </div>
              )}

            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DataAnalysis(props: DataAnalysisProps) {
  const { ingestionResult, filename, onReset } = props;
  return (
    <AnalysisProvider ingestionResult={ingestionResult} filename={filename} onReset={onReset}>
      <DataAnalysisInner />
    </AnalysisProvider>
  );
}
