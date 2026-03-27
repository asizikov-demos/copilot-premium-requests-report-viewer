'use client';

import React, { useMemo } from 'react';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { ModelDailyStackedChart } from '@/components/charts/ModelDailyStackedChart';
import { buildDailyModelUsageFromArtifacts } from '@/utils/ingestion/analytics';
import { generateModelColors } from '@/utils/modelColors';

export function ModelUsageTrendsOverview() {
  const { usageArtifacts, dailyBucketsArtifacts, selectedMonths } = useAnalysisContext();

  const { data, models } = useMemo(() => {
    // For now, we ignore month filtering at the aggregation level and rely on
    // the existing dateRange from dailyBucketsArtifacts, which is already
    // derived in UTC from the ingested CSV. Future refinement could slice the
    // series based on selectedMonths if artifact months are present.
    if (!usageArtifacts || !dailyBucketsArtifacts) {
      return { data: [], models: [] as string[] };
    }

    const raw = buildDailyModelUsageFromArtifacts(dailyBucketsArtifacts, usageArtifacts);

    // Optional: filter by selectedMonths if provided and artifact dateRange spans multiple months.
    const filtered = selectedMonths.length === 0
      ? raw
      : raw.filter(d => selectedMonths.includes(d.date.slice(0, 7)));

    const modelKeys = Object.keys(usageArtifacts.modelTotals).sort();
    return { data: filtered, models: modelKeys };
  }, [usageArtifacts, dailyBucketsArtifacts, selectedMonths]);

  const modelColors: Record<string, string> = useMemo(() => {
    return generateModelColors(models);
  }, [models]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Model Usage Trends</h2>
        <p className="text-sm text-[#636c76] mt-1">
          Daily stacked view by model (UTC)
        </p>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md p-5 min-h-[20rem]">
        {data.length === 0 || models.length === 0 ? (
          <p className="text-sm text-[#636c76]">No model usage data available for the selected period.</p>
        ) : (
          <div className="h-80 2xl:h-96">
            <ModelDailyStackedChart data={data} models={models} modelColors={modelColors} />
          </div>
        )}
      </div>
    </div>
  );
}
