'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRightIcon } from '@primer/octicons-react';

import { buildDailyConsumptionRows, type DailyConsumptionRow } from '@/utils/dailyConsumption';
import type { ModelDailyArtifacts } from '@/utils/ingestion/ModelDailyAggregator';
import { formatCurrency, formatDecimalQuantity, formatUtcDateLabel } from '@/utils/formatters';
import type { DailyModelUsageDatum } from '@/utils/ingestion/analytics';

interface DailyConsumptionTableProps {
  data: DailyModelUsageDatum[];
  models: string[];
  commercialByDay: ModelDailyArtifacts['commercialByDay'];
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <ChevronRightIcon
      size={16}
      className={`shrink-0 text-(--fgColor-muted) transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
    />
  );
}

function UsageCells({ row, emphasized = false }: { row: Omit<DailyConsumptionRow, 'date' | 'models'>; emphasized?: boolean }) {
  return (
    <>
      <td className={`px-5 py-3.5 text-right text-sm font-mono tabular-nums ${emphasized ? 'font-semibold text-(--fgColor-default)' : 'text-(--fgColor-muted)'}`}>
        {formatDecimalQuantity(row.includedCredits)}
      </td>
      <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-(--fgColor-muted)">
        {formatDecimalQuantity(row.additionalCredits)}
      </td>
      <td className="px-5 py-3.5 text-right text-sm font-mono tabular-nums text-(--fgColor-muted)">
        {formatCurrency(row.grossAmount)}
      </td>
      <td className={`px-5 py-3.5 text-right text-sm font-mono tabular-nums ${row.additionalUsage > 0 ? 'font-medium text-(--fgColor-danger)' : emphasized ? 'font-semibold text-(--fgColor-default)' : 'text-(--fgColor-muted)'}`}>
        {formatCurrency(row.additionalUsage)}
      </td>
    </>
  );
}

export function DailyConsumptionTable({
  data,
  models,
  commercialByDay,
}: DailyConsumptionTableProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const rows = useMemo(
    () => buildDailyConsumptionRows(data, models, commercialByDay),
    [data, models, commercialByDay]
  );
  const columnCount = 5;

  return (
    <div className="overflow-hidden rounded-md border border-(--borderColor-default) bg-(--bgColor-default)">
      <div className="border-b border-(--borderColor-default) px-5 py-4">
        <h3 className="text-sm font-medium text-(--fgColor-default)">Daily Consumption</h3>
        <p className="mt-0.5 text-xs text-(--fgColor-muted)">
          Expand a day to view consumption by model.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full" aria-label="Daily consumption">
          <thead>
            <tr className="border-b border-(--borderColor-default) bg-(--bgColor-muted)">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">
                Date
              </th>
                <>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">
                    Included credits
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">
                    Additional credits
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">
                    Gross amount
                  </th>
                  <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">
                    Additional usage
                  </th>
                </>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--borderColor-default)">
            {rows.map((row, index) => {
              const isExpanded = expandedDate === row.date;
              const detailsId = `daily-consumption-details-${index}`;

              return (
                <React.Fragment key={row.date}>
                  <tr className="transition-colors duration-150 hover:bg-(--bgColor-muted)">
                    <td className="px-5 py-3.5 text-sm font-medium text-(--fgColor-default)">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 text-left"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        onClick={() => setExpandedDate(isExpanded ? null : row.date)}
                      >
                        <ChevronIcon expanded={isExpanded} />
                        {formatUtcDateLabel(row.date)}
                      </button>
                    </td>
                    <UsageCells row={row} emphasized />
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td id={detailsId} colSpan={columnCount} className="p-0">
                        <table className="min-w-full bg-(--bgColor-muted)" aria-label={`${formatUtcDateLabel(row.date)} model consumption`}>
                          <thead>
                            <tr className="border-y border-(--borderColor-default)">
                              <th className="px-12 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">
                                Model
                              </th>
                                <>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">Included credits</th>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">Additional credits</th>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">Gross amount</th>
                                  <th className="whitespace-nowrap px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-(--fgColor-muted)">Additional usage</th>
                                </>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-(--borderColor-default)">
                            {row.models.map((model) => (
                              <tr key={model.model}>
                                <td className="px-12 py-3 text-sm font-medium text-(--fgColor-default)">{model.model}</td>
                                <UsageCells row={model} />
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
