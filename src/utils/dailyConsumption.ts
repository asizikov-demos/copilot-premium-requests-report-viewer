import { PRICING } from '@/constants/pricing';
import type { DailyModelUsageDatum } from '@/utils/ingestion/analytics';
import type { ModelDailyArtifacts } from '@/utils/ingestion/ModelDailyAggregator';

import { buildBillingMonthDates } from './dateKeys';

interface ConsumptionMetrics {
  consumption: number;
  includedCredits: number;
  additionalCredits: number;
  grossAmount: number;
  additionalUsage: number;
}

export interface DailyConsumptionRow extends ConsumptionMetrics {
  date: string;
  models: (ConsumptionMetrics & { model: string })[];
}

export interface DailyConsumptionDatum {
  date: string;
  included: number;
  additional: number;
}

export function aggregateDailyConsumption(
  byDay: ReadonlyMap<string, DailyConsumptionDatum>,
  reportMonth: string | undefined
): DailyConsumptionDatum[] {
  if (byDay.size === 0) {
    return [];
  }

  return buildBillingMonthDates(reportMonth).map(date =>
    byDay.get(date) ?? { date, included: 0, additional: 0 }
  );
}

function createMetrics(consumption: number, grossAmount: number, additionalUsage: number): ConsumptionMetrics {
  const additionalCredits = Math.min(consumption, additionalUsage / PRICING.AI_CREDIT_USD_VALUE);
  return {
    consumption, includedCredits: Math.max(consumption - additionalCredits, 0),
    additionalCredits, grossAmount, additionalUsage,
  };
}

export function buildDailyConsumptionRows(
  data: DailyModelUsageDatum[],
  models: string[],
  commercialByDay: ModelDailyArtifacts['commercialByDay']
): DailyConsumptionRow[] {
  return data.map(datum => {
    const dateModels = commercialByDay.get(datum.date);
    const modelRows = models.map(model => {
      const consumption = Number(datum[model] ?? 0);
      const commercial = dateModels?.get(model);
      return {
        model,
        ...createMetrics(
          consumption,
          commercial?.grossAmount ?? consumption * PRICING.AI_CREDIT_USD_VALUE,
          commercial?.additionalUsage ?? 0
        ),
      };
    }).filter(row => row.consumption > 0)
      .sort((left, right) => right.consumption - left.consumption || left.model.localeCompare(right.model));
    return {
      date: datum.date,
      models: modelRows,
      ...createMetrics(
        datum.totalCredits,
        modelRows.reduce((total, row) => total + row.grossAmount, 0),
        modelRows.reduce((total, row) => total + row.additionalUsage, 0)
      ),
    };
  });
}
