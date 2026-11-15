import { PRICING } from '@/constants/pricing';
import { accumulateAutoModeSavings, type AutoModeSavingsRow } from '@/utils/autoModeSavings';
import type { DailyConsumptionDatum } from '@/utils/dailyConsumption';
import { accumulateProductCost, createEmptyProductCostMap, type ProductCost } from '@/utils/productCosts';
import type { ProductCategory } from '@/utils/productClassification';

import type { Aggregator, NormalizedRow } from './types';

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
  models: Set<string>;
  productCosts: Map<ProductCategory, ProductCost>;
  autoModeSavings: Map<string, AutoModeSavingsRow>;
  dailyConsumption: Map<string, DailyConsumptionDatum>;
  commercialByDay: Map<string, Map<string, ModelCommercialTotals>>;
  buckets: ModelBucket[];
}

function emptyArtifacts(): ModelDailyArtifacts {
  return {
    rowCount: 0, hasOrganizations: false, hasCostCenters: false,
    models: new Set(), productCosts: createEmptyProductCostMap(),
    autoModeSavings: new Map(), dailyConsumption: new Map(),
    commercialByDay: new Map(),
    buckets: MODEL_BUCKETS.map(() => ({ models: new Map(), users: new Set() })),
  };
}

export class ModelDailyAggregator implements Aggregator<ModelDailyArtifacts> {
  readonly id = 'modelDaily';
  private result = emptyArtifacts();

  init(): void {
    this.result = emptyArtifacts();
  }

  onRow(row: NormalizedRow): void {
    const result = this.result;
    result.rowCount++;
    result.hasOrganizations ||= Boolean(row.organization);
    result.hasCostCenters ||= Boolean(row.costCenter);
    result.models.add(row.model);
    accumulateProductCost(result.productCosts, row);
    accumulateAutoModeSavings(result.autoModeSavings, row);
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
