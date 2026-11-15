import { PRICING } from '@/constants/pricing';
import { accumulateAutoModeSavings, getAutoModeBaseModel, type AutoModeSavingsRow } from '@/utils/autoModeSavings';
import type { DailyConsumptionDatum } from '@/utils/dailyConsumption';
import { accumulateProductCost, createEmptyProductCostMap, type ProductCost } from '@/utils/productCosts';
import type { ProductCategory } from '@/utils/productClassification';

import { MonthlyAggregator } from './MonthlyAggregator';
import type { Aggregator, MonthlyArtifacts, NormalizedRow } from './types';

export const MODEL_BUCKETS = [
  { label: 'Auto', prefix: 'Auto:' },
  { label: 'Fusion (Standard)', prefix: 'Fusion (Standard):' },
  { label: 'Fusion (High)', prefix: 'Fusion (High):' },
  { label: 'Fusion (Max)', prefix: 'Fusion (Max):' },
] as const;

export interface ModelCommercialTotals {
  grossAmount: number;
  additionalUsage: number;
}

export interface ModelBucket {
  models: Map<string, { credits: number; grossAmount: number }>;
  users: Set<string>;
}

export interface ModelDailyArtifacts {
  rowCount: number;
  hasOrganizations: boolean;
  hasCostCenters: boolean;
  months: string[];
  modelFirstSeen: Map<string, number>;
  productCosts: Map<ProductCategory, ProductCost>;
  autoModeSavings: Map<string, AutoModeSavingsRow>;
  autoModelFirstSeen: Map<string, number>;
  dailyConsumption: Map<string, DailyConsumptionDatum>;
  commercialByDay: Map<string, Map<string, ModelCommercialTotals>>;
  buckets: ModelBucket[];
}

function emptyArtifacts(): ModelDailyArtifacts {
  return {
    rowCount: 0, hasOrganizations: false, hasCostCenters: false, months: [],
    modelFirstSeen: new Map(), productCosts: createEmptyProductCostMap(),
    autoModeSavings: new Map(), autoModelFirstSeen: new Map(), dailyConsumption: new Map(),
    commercialByDay: new Map(),
    buckets: MODEL_BUCKETS.map(() => ({ models: new Map(), users: new Set() })),
  };
}

class ModelDailyAccumulator implements Aggregator<ModelDailyArtifacts> {
  readonly id = 'modelDaily';
  private result = emptyArtifacts();

  onRow(row: NormalizedRow, _ctx: unknown, sequence = 0): void {
    const result = this.result;
    result.rowCount++;
    result.hasOrganizations ||= Boolean(row.organization);
    result.hasCostCenters ||= Boolean(row.costCenter);
    if (!result.months.length) result.months.push(row.day.slice(0, 7));
    if (!result.modelFirstSeen.has(row.model)) result.modelFirstSeen.set(row.model, sequence);
    accumulateProductCost(result.productCosts, row);
    accumulateAutoModeSavings(result.autoModeSavings, row);
    const autoModel = getAutoModeBaseModel(row.model);
    if (autoModel && row.grossAmount !== undefined && !result.autoModelFirstSeen.has(autoModel)) {
      result.autoModelFirstSeen.set(autoModel, sequence);
    }

    if (row.discountAmount !== undefined || row.netAmount !== undefined) {
      const day = result.dailyConsumption.get(row.day) ?? { date: row.day, included: 0, additional: 0 };
      day.included += row.discountAmount ?? 0;
      day.additional += row.netAmount ?? 0;
      result.dailyConsumption.set(row.day, day);
    }

    const grossAmount = row.aicGrossAmount ?? row.quantity * PRICING.AI_CREDIT_USD_VALUE;
    const additionalUsage = row.netAmount ?? (
      row.grossAmount === undefined ? 0 : Math.max(row.grossAmount - (row.discountAmount ?? 0), 0)
    );
    const dayModels = result.commercialByDay.get(row.day) ?? new Map<string, ModelCommercialTotals>();
    const commercial = dayModels.get(row.model) ?? { grossAmount: 0, additionalUsage: 0 };
    commercial.grossAmount += grossAmount;
    commercial.additionalUsage += additionalUsage;
    dayModels.set(row.model, commercial);
    result.commercialByDay.set(row.day, dayModels);

    const index = MODEL_BUCKETS.findIndex(({ prefix }) => row.model.toLowerCase().startsWith(prefix.toLowerCase()));
    if (index < 0) return;
    const bucket = result.buckets[index];
    if (row.user.trim() && !row.isUnattributedUsage) bucket.users.add(row.user);
    const model = row.model.slice(MODEL_BUCKETS[index].prefix.length).trim();
    const amounts = bucket.models.get(model) ?? { credits: 0, grossAmount: 0 };
    amounts.credits += row.quantity;
    amounts.grossAmount += grossAmount;
    bucket.models.set(model, amounts);
  }

  finalize(): ModelDailyArtifacts {
    return this.result;
  }
}

export function mergeModelDailyArtifacts(partials: readonly ModelDailyArtifacts[]): ModelDailyArtifacts {
  const result = emptyArtifacts();
  for (const partial of partials) {
    result.rowCount += partial.rowCount;
    result.hasOrganizations ||= partial.hasOrganizations;
    result.hasCostCenters ||= partial.hasCostCenters;
    result.months.push(...partial.months);
    for (const key of ['modelFirstSeen', 'autoModelFirstSeen'] as const) {
      for (const [model, sequence] of partial[key]) {
        result[key].set(model, Math.min(result[key].get(model) ?? Infinity, sequence));
      }
    }
    for (const [category, source] of partial.productCosts) {
      const target = result.productCosts.get(category)!;
      for (const field of ['credits', 'gross', 'discount', 'net', 'aicQuantity', 'aicGrossAmount'] as const) {
        target[field] += source[field];
      }
    }
    for (const [model, source] of partial.autoModeSavings) {
      const target = result.autoModeSavings.get(model) ?? { model, quantity: 0, costBeforeAuto: 0, savings: 0 };
      target.quantity += source.quantity;
      target.costBeforeAuto += source.costBeforeAuto;
      target.savings += source.savings;
      result.autoModeSavings.set(model, target);
    }
    // Month partitions have disjoint days; selectors treat shared daily maps as read-only.
    for (const [day, value] of partial.dailyConsumption) result.dailyConsumption.set(day, value);
    for (const [day, value] of partial.commercialByDay) result.commercialByDay.set(day, value);
    partial.buckets.forEach((source, index) => {
      const target = result.buckets[index];
      for (const user of source.users) target.users.add(user);
      for (const [model, amounts] of source.models) {
        const totals = target.models.get(model) ?? { credits: 0, grossAmount: 0 };
        totals.credits += amounts.credits;
        totals.grossAmount += amounts.grossAmount;
        target.models.set(model, totals);
      }
    });
  }
  result.months = [...new Set(result.months)].sort();
  result.autoModeSavings = new Map([...result.autoModeSavings].sort(([a], [b]) =>
    result.autoModelFirstSeen.get(a)! - result.autoModelFirstSeen.get(b)!));
  return result;
}

export class ModelDailyAggregator extends MonthlyAggregator<ModelDailyArtifacts> {
  constructor() {
    super('modelDaily', () => new ModelDailyAccumulator(), mergeModelDailyArtifacts);
  }
}

export function selectModelDailyArtifacts(
  artifacts: MonthlyArtifacts<ModelDailyArtifacts>,
  selectedMonths: readonly string[]
): ModelDailyArtifacts {
  if (!selectedMonths.length) return artifacts;
  const months = new Set(selectedMonths);
  return mergeModelDailyArtifacts([...artifacts.byMonth]
    .filter(([month]) => months.has(month)).map(([, partial]) => partial));
}
