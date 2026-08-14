'use client';

import React, { useMemo, useState } from 'react';

import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import { getEffectiveAicQuantity } from '@/utils/aicFields';
import { formatCurrency, formatDecimalQuantity } from '@/utils/formatters';
import type { DailyModelUsageDatum } from '@/utils/ingestion/analytics';

interface ConsumptionMetrics {
  consumption: number;
  includedCredits: number;
  additionalCredits: number;
  grossAmount: number;
  additionalUsage: number;
}

interface DailyModelConsumptionRow extends ConsumptionMetrics {
  model: string;
}

interface DailyConsumptionRow extends ConsumptionMetrics {
  date: string;
  models: DailyModelConsumptionRow[];
}

interface DailyConsumptionTableProps {
  data: DailyModelUsageDatum[];
  models: string[];
  isUsageBasedBilling: boolean;
  sourceRows: ProcessedData[];
}

function formatUtcDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

function getAdditionalUsage(row: ProcessedData): number {
  if (typeof row.netAmount === 'number') {
    return row.netAmount;
  }

  if (typeof row.grossAmount === 'number') {
    return Math.max(row.grossAmount - (row.discountAmount ?? 0), 0);
  }

  return 0;
}

function createMetrics(consumption: number, grossAmount: number, additionalUsage: number): ConsumptionMetrics {
  const additionalCredits = Math.min(
    consumption,
    additionalUsage / PRICING.AI_CREDIT_USD_VALUE
  );

  return {
    consumption,
    includedCredits: Math.max(consumption - additionalCredits, 0),
    additionalCredits,
    grossAmount,
    additionalUsage,
  };
}

function buildDailyConsumptionRows(
  data: DailyModelUsageDatum[],
  models: string[],
  isUsageBasedBilling: boolean,
  sourceRows: ProcessedData[]
): DailyConsumptionRow[] {
  const commercialByDateAndModel = new Map<string, Map<string, { grossAmount: number; additionalUsage: number }>>();

  if (isUsageBasedBilling) {
    for (const row of sourceRows) {
      const dateModels = commercialByDateAndModel.get(row.dateKey) ?? new Map();
      const modelTotals = dateModels.get(row.model) ?? { grossAmount: 0, additionalUsage: 0 };
      const aicQuantity = getEffectiveAicQuantity(row);

      modelTotals.grossAmount += row.aicGrossAmount ?? aicQuantity * PRICING.AI_CREDIT_USD_VALUE;
      modelTotals.additionalUsage += getAdditionalUsage(row);
      dateModels.set(row.model, modelTotals);
      commercialByDateAndModel.set(row.dateKey, dateModels);
    }
  }

  return data.map((datum) => {
    const dateModels = commercialByDateAndModel.get(datum.date);
    const modelRows = models
      .map((model) => {
        const consumption = Number(datum[model] ?? 0);
        const commercial = dateModels?.get(model);
        const grossAmount = isUsageBasedBilling
          ? commercial?.grossAmount ?? consumption * PRICING.AI_CREDIT_USD_VALUE
          : 0;
        const additionalUsage = commercial?.additionalUsage ?? 0;

        return {
          model,
          ...createMetrics(consumption, grossAmount, additionalUsage),
        };
      })
      .filter((row) => row.consumption > 0)
      .sort((left, right) => right.consumption - left.consumption || left.model.localeCompare(right.model));

    const grossAmount = modelRows.reduce((total, row) => total + row.grossAmount, 0);
    const additionalUsage = modelRows.reduce((total, row) => total + row.additionalUsage, 0);

    return {
      date: datum.date,
      models: modelRows,
      ...createMetrics(datum.totalRequests, grossAmount, additionalUsage),
    };
  });
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-[#636c76] transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsageCells({ row, emphasized = false }: { row: ConsumptionMetrics; emphasized?: boolean }) {
  return (
    <>
      <td className={`px-5 py-3.5 text-right text-sm font-mono tabular-nums ${emphasized ? 'font-semibold text-[#1f2328]' : 'text-[#636c76]'}`}>
        {formatDecimalQuantity(row.includedCredits)}
      </td>
      <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-[#636c76]">
        {formatDecimalQuantity(row.additionalCredits)}
      </td>
      <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-[#636c76]">
        {formatCurrency(row.grossAmount)}
      </td>
      <td className={`px-5 py-3.5 text-right text-sm font-mono tabular-nums ${row.additionalUsage > 0 ? 'font-medium text-red-600' : emphasized ? 'font-semibold text-[#1f2328]' : 'text-[#636c76]'}`}>
        {formatCurrency(row.additionalUsage)}
      </td>
    </>
  );
}

export function DailyConsumptionTable({
  data,
  models,
  isUsageBasedBilling,
  sourceRows,
}: DailyConsumptionTableProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const rows = useMemo(
    () => buildDailyConsumptionRows(data, models, isUsageBasedBilling, sourceRows),
    [data, isUsageBasedBilling, models, sourceRows]
  );
  const columnCount = isUsageBasedBilling ? 5 : 2;

  return (
    <div className="overflow-hidden rounded-md border border-[#d1d9e0] bg-white">
      <div className="border-b border-[#d1d9e0] px-5 py-4">
        <h3 className="text-sm font-medium text-[#1f2328]">Daily Consumption</h3>
        <p className="mt-0.5 text-xs text-[#636c76]">
          Expand a day to view consumption by model.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full" aria-label="Daily consumption">
          <thead>
            <tr className="border-b border-[#d1d9e0] bg-[#f6f8fa]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">
                Date
              </th>
              {isUsageBasedBilling ? (
                <>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">
                    Included credits
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">
                    Additional credits
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">
                    Gross amount
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">
                    Additional usage
                  </th>
                </>
              ) : (
                <th className="whitespace-nowrap px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">
                  Requests
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d1d9e0]">
            {rows.map((row, index) => {
              const isExpanded = expandedDate === row.date;
              const detailsId = `daily-consumption-details-${index}`;

              return (
                <React.Fragment key={row.date}>
                  <tr className="transition-colors duration-150 hover:bg-[#fcfdff]">
                    <td className="px-5 py-3.5 text-sm font-medium text-[#1f2328]">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 text-left"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        onClick={() => setExpandedDate(isExpanded ? null : row.date)}
                      >
                        <ChevronIcon expanded={isExpanded} />
                        {formatUtcDate(row.date)}
                      </button>
                    </td>
                    {isUsageBasedBilling ? (
                      <UsageCells row={row} emphasized />
                    ) : (
                      <td className="px-5 py-3.5 text-right text-sm font-mono font-semibold tabular-nums text-[#1f2328]">
                        {formatDecimalQuantity(row.consumption)}
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td id={detailsId} colSpan={columnCount} className="p-0">
                        <table className="min-w-full bg-[#f6f8fa]" aria-label={`${formatUtcDate(row.date)} model consumption`}>
                          <thead>
                            <tr className="border-y border-[#d1d9e0]">
                              <th className="px-12 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">
                                Model
                              </th>
                              {isUsageBasedBilling ? (
                                <>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">Included credits</th>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">Additional credits</th>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">Gross amount</th>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">Additional usage</th>
                                </>
                              ) : (
                                <th className="whitespace-nowrap px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#636c76]">Requests</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#d1d9e0]">
                            {row.models.map((model) => (
                              <tr key={model.model}>
                                <td className="px-12 py-3 text-sm font-medium text-[#1f2328]">{model.model}</td>
                                {isUsageBasedBilling ? (
                                  <UsageCells row={model} />
                                ) : (
                                  <td className="px-5 py-3 text-right text-sm font-mono tabular-nums text-[#636c76]">
                                    {formatDecimalQuantity(model.consumption)}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
