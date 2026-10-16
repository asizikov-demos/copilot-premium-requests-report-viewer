'use client';

import React, { useMemo } from 'react';

import { DailyConsumptionTable } from '@/components/DailyConsumptionTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { ModelDailyStackedChart } from '@/components/charts/ModelDailyStackedChart';
import { filterDailySeriesByMonths } from '@/utils/analytics/filters';
import { formatCurrency } from '@/utils/formatters';
import { buildDailyModelUsageFromArtifacts } from '@/utils/ingestion/analytics';
import { generateModelColors } from '@/utils/modelColors';

interface TopAicModelRow {
  model: string;
  aicQuantity: number;
  aicGrossAmount: number;
  share: number;
}

export function ModelUsageTrendsOverview() {
  const {
    usageArtifacts,
    dailyBucketsArtifacts,
    selectedMonths,
    billingArtifacts,
    aggregateProcessedData,
  } = useAnalysisContext();
  const { data, models } = useMemo(() => {
    if (!dailyBucketsArtifacts) {
      return { data: [], models: [] as string[] };
    }

    if (!usageArtifacts) {
      return { data: [], models: [] as string[] };
    }
    const raw = buildDailyModelUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);
    return {
      data: filterDailySeriesByMonths(raw, selectedMonths),
      models: Object.keys(usageArtifacts.modelTotals).sort(),
    };
  }, [dailyBucketsArtifacts, selectedMonths, usageArtifacts]);

  const modelColors: Record<string, string> = useMemo(() => {
    return generateModelColors(models);
  }, [models]);

  const topAicModelAnalysis = useMemo((): { rows: TopAicModelRow[]; topShare: number } => {
    if (aggregateProcessedData.length === 0) {
      return { rows: [], topShare: 0 };
    }

    const creditsByModel = new Map<string, number>();
    for (const row of aggregateProcessedData) {
      creditsByModel.set(row.model, (creditsByModel.get(row.model) ?? 0) + row.creditsUsed);
    }
    const rows = [...creditsByModel.entries()]
      .map(([model, credits]) => ({
        model,
        aicQuantity: credits,
        aicGrossAmount: billingArtifacts?.billingByModel.get(model)?.aicGrossAmount ?? 0,
      }))
      .filter((row) => row.aicQuantity > 0 || row.aicGrossAmount > 0);

    const totalConsumption = rows.reduce((sum, row) => sum + row.aicQuantity, 0);

    const topRows = rows
      .sort((left, right) => {
        if (right.aicQuantity !== left.aicQuantity) {
          return right.aicQuantity - left.aicQuantity;
        }

        return left.model.localeCompare(right.model);
      })
      .slice(0, 3)
      .map((row) => ({
        ...row,
        share: totalConsumption > 0 ? (row.aicQuantity / totalConsumption) * 100 : 0,
      }));

    const topConsumption = topRows.reduce((sum, row) => sum + row.aicQuantity, 0);

    return {
      rows: topRows,
      topShare: totalConsumption > 0 ? (topConsumption / totalConsumption) * 100 : 0,
    };
  }, [aggregateProcessedData, billingArtifacts]);
  const { rows: topAicModelRows, topShare: topAicModelShare } = topAicModelAnalysis;

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-(--fgColor-default)">Model Usage Trends</h2>
        <p className="text-sm text-(--fgColor-muted) mt-1">
          Daily stacked AI Credits by model (UTC)
        </p>
      </div>

      {topAicModelRows.length > 0 && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 className="text-sm font-medium text-(--fgColor-default)">Top AI Credits Models</h3>
            <p className="text-xs text-(--fgColor-muted) mt-0.5">Top 3 models by AI Credits consumed</p>
            <p className="text-sm text-(--fgColor-default) mt-3">
              Top 3 models drive <span className="font-semibold">{topAicModelShare.toFixed(1)}%</span> of total AI Credits consumption.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Top AI Credits models">
              <thead>
                <tr className="border-b border-(--borderColor-default)">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">Rank</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">Model</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">AI Credits</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">AI Credits Gross</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted) whitespace-nowrap">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--borderColor-default)">
                {topAicModelRows.map((row, index) => (
                  <tr key={row.model} className="hover:bg-(--bgColor-muted) transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-(--fgColor-muted)">#{index + 1}</td>
                    <td className="px-5 py-3 text-sm font-medium text-(--fgColor-default)">{row.model}</td>
                    <td className="px-5 py-3 text-sm font-mono font-semibold text-(--fgColor-default) text-right">
                      {row.aicQuantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-(--fgColor-muted) text-right">{formatCurrency(row.aicGrossAmount)}</td>
                    <td className="px-5 py-3 text-sm font-mono text-(--fgColor-muted) text-right">{row.share.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md p-5 min-h-[20rem]">
        {data.length === 0 || models.length === 0 ? (
          <p className="text-sm text-(--fgColor-muted)">No model usage data available for the selected period.</p>
        ) : (
          <div className="h-80 2xl:h-96">
            <ModelDailyStackedChart
              data={data}
              models={models}
              modelColors={modelColors}
              valueUnitLabel="AI Credits"
            />
          </div>
        )}
      </div>

      {data.length > 0 && models.length > 0 && (
        <DailyConsumptionTable
          data={data}
          models={models}
          sourceRows={aggregateProcessedData}
        />
      )}
    </div>
  );
}
