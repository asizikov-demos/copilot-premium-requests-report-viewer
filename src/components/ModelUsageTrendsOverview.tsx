'use client';

import React, { useMemo } from 'react';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { ModelDailyStackedChart } from '@/components/charts/ModelDailyStackedChart';
import { buildDailyModelUsageFromArtifacts } from '@/utils/ingestion/analytics';
import { generateModelColors } from '@/utils/modelColors';

export function ModelUsageTrendsOverview() {
  const { usageArtifacts, dailyBucketsArtifacts, selectedMonths, setView } = useAnalysisContext();

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Model Usage Trends</h2>
          <p className="text-sm text-gray-600 mt-1">
            Stacked daily view of premium requests by model. Dates are grouped by UTC day as provided in the CSV.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView('overview')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <span className="mr-1">&larr;</span>
          Back to Overview
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6 min-h-[24rem]">
        {data.length === 0 || models.length === 0 ? (
          <p className="text-sm text-gray-500">No model usage data available for the selected period.</p>
        ) : (
          <div className="h-96 2xl:h-[32rem]">
            <ModelDailyStackedChart data={data} models={models} modelColors={modelColors} />
          </div>
        )}
      </div>
    </div>
  );
}
