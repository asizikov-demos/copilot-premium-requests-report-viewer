import { getEffectiveAicQuantity } from '@/utils/aicFields';
import type { CreditTotals, UserConsumption } from '@/types/consumption';
import type { DailyConsumptionDatum } from '@/utils/dailyConsumption';
import { buildBillingMonthDates, enumerateDatesInclusive } from '@/utils/dateKeys';
import {
  accumulateProductCost, createEmptyProductCostMap, getPopulatedProductCosts,
  type ProductCost,
} from '@/utils/productCosts';
import { UserHeaderAccumulator } from '@/utils/userHeaderSummary';

import type { Aggregator, NormalizedRow } from './types';

interface CostTotals {
  quantity: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
}

export interface DetailDailyModelRow extends Omit<CostTotals, 'quantity'> {
  date: string;
  model: string;
  costCenter?: string;
  credits: number;
  isFirstInDate: boolean;
  rowSpan: number;
  cacheSuccessRate?: { percent: number; reportedRows: number; totalRows: number };
}

export interface DetailArtifacts {
  hasBillingData: boolean;
  models: string[];
  header: ReturnType<UserHeaderAccumulator['finalize']>;
  consumption: UserConsumption;
  totals: CostTotals;
  productCosts: ProductCost[];
  costCenterCosts: (CostTotals & { name: string })[];
  userRows: (CostTotals & { user: string })[];
  dailyRows: (CostTotals & { date: string; products: ProductCost[] })[];
  dailyModels: DetailDailyModelRow[];
  dailyModelTotals: Map<string, Record<string, number>>;
  dailyConsumption: DailyConsumptionDatum[];
}

interface ModelBucket {
  quantity: number;
  costs: Map<string, Float64Array>;
  cache: Float64Array;
}

export interface CompactDetailArtifacts {
  hasBillingData: boolean;
  header: ReturnType<UserHeaderAccumulator['finalize']>;
  consumption: UserConsumption;
  totals: CostTotals;
  products: ReturnType<typeof createEmptyProductCostMap>;
  dailyProducts: Map<string, ReturnType<typeof createEmptyProductCostMap>>;
  costCenters: Map<string, CostTotals & { name: string }>;
  users: Map<string, CostTotals & { user: string }>;
  dailyModels: Map<string, Map<string, ModelBucket>>;
  dailyConsumption: Map<string, DailyConsumptionDatum>;
}

function emptyCosts(): CostTotals {
  return { quantity: 0, gross: 0, discount: 0, net: 0, aicGrossAmount: 0 };
}

function addCosts(target: CostTotals, row: NormalizedRow): void {
  target.quantity += row.quantity;
  target.gross += row.grossAmount ?? 0;
  target.discount += row.discountAmount ?? 0;
  target.net += row.netAmount ?? 0;
  target.aicGrossAmount += row.aicGrossAmount ?? 0;
}

function addCredits(target: CreditTotals, quantity: number | undefined): void {
  target.rowCount++;
  if (quantity === undefined) return;
  target.reportedRows++;
  target.quantity = (target.quantity ?? 0) + quantity;
}

/** Compact drill-down buckets; source rows are never retained. */
export class DetailAggregator implements Aggregator<CompactDetailArtifacts> {
  readonly id = 'details';
  private header = new UserHeaderAccumulator();
  private totals = emptyCosts();
  private products = createEmptyProductCostMap();
  private dailyProducts = new Map<string, ReturnType<typeof createEmptyProductCostMap>>();
  private costCenters = new Map<string, CostTotals & { name: string }>();
  private users = new Map<string, CostTotals & { user: string }>();
  private dailyModels = new Map<string, Map<string, ModelBucket>>();
  private dailyConsumption = new Map<string, DailyConsumptionDatum>();
  private credits: CreditTotals = { rowCount: 0, reportedRows: 0 };
  private creditsByModel = new Map<string, CreditTotals>();
  private hasBillingData = false;

  onRow(row: NormalizedRow): void {
    this.header.add(row);
    this.hasBillingData ||= [row.grossAmount, row.discountAmount, row.netAmount, row.aicGrossAmount]
      .some(value => value !== undefined);
    addCosts(this.totals, row);
    accumulateProductCost(this.products, row);
    const dailyProducts = this.dailyProducts.get(row.day) ?? createEmptyProductCostMap();
    accumulateProductCost(dailyProducts, row);
    this.dailyProducts.set(row.day, dailyProducts);
    if (row.costCenter) {
      const costs = this.costCenters.get(row.costCenter) ?? { ...emptyCosts(), name: row.costCenter };
      addCosts(costs, row);
      this.costCenters.set(row.costCenter, costs);
    }
    if (!row.isUnattributedUsage) {
      const costs = this.users.get(row.user) ?? { ...emptyCosts(), user: row.user };
      addCosts(costs, row);
      this.users.set(row.user, costs);
    }
    let dayModels = this.dailyModels.get(row.day);
    if (!dayModels) this.dailyModels.set(row.day, dayModels = new Map());
    let model = dayModels.get(row.model);
    if (!model) dayModels.set(row.model, model = { quantity: 0, costs: new Map(), cache: new Float64Array(5) });
    model.quantity += row.quantity;
    const center = row.costCenter ?? '';
    let costs = model.costs.get(center);
    if (!costs) model.costs.set(center, costs = new Float64Array(5));
    // quantity, gross, discount, net, AI-credit gross; no presentation fields.
    costs[0] += row.quantity;
    costs[1] += row.grossAmount ?? 0;
    costs[2] += row.discountAmount ?? 0;
    costs[3] += row.netAmount ?? 0;
    costs[4] += row.aicGrossAmount ?? 0;
    const cache = model.cache;
    // input, cache read, cache write, complete rows, all rows.
    cache[4]++;
    if (row.inputTokens !== undefined && row.cacheReadTokens !== undefined && row.cacheWriteTokens !== undefined) {
      cache[0] += row.inputTokens;
      cache[1] += row.cacheReadTokens;
      cache[2] += row.cacheWriteTokens;
      cache[3]++;
    }
    if (row.discountAmount !== undefined || row.netAmount !== undefined) {
      const day = this.dailyConsumption.get(row.day) ?? { date: row.day, included: 0, additional: 0 };
      day.included += row.discountAmount ?? 0;
      day.additional += row.netAmount ?? 0;
      this.dailyConsumption.set(row.day, day);
    }
    const quantity = row.aicQuantity !== undefined || row.aicGrossAmount !== undefined
      ? getEffectiveAicQuantity(row)
      : row.usageUnit === 'ai_credit' ? row.billingQuantity : undefined;
    addCredits(this.credits, quantity);
    const credits = this.creditsByModel.get(row.model) ?? { rowCount: 0, reportedRows: 0 };
    addCredits(credits, quantity);
    this.creditsByModel.set(row.model, credits);
  }

  finalize(): CompactDetailArtifacts {
    return {
      hasBillingData: this.hasBillingData, header: this.header.finalize(),
      consumption: { credits: this.credits, creditsByModel: this.creditsByModel },
      totals: this.totals, products: this.products, dailyProducts: this.dailyProducts,
      costCenters: this.costCenters, users: this.users, dailyModels: this.dailyModels,
      dailyConsumption: this.dailyConsumption,
    };
  }
}

/** Materialize only the selected scope; never store padded/sorted view models for every user. */
export function selectDetailArtifacts(compact: CompactDetailArtifacts): DetailArtifacts {
    const sortedDays = [...compact.dailyProducts.keys()].sort();
    const dailyRows = sortedDays.length === 0 ? [] : enumerateDatesInclusive(sortedDays[0], sortedDays.at(-1)!).map(date => {
      const bucket = compact.dailyProducts.get(date);
      const products = bucket ? getPopulatedProductCosts(bucket) : [];
      return products.reduce((totals, product) => ({
        ...totals, quantity: totals.quantity + product.credits,
        gross: totals.gross + product.gross, discount: totals.discount + product.discount,
        net: totals.net + product.net, aicGrossAmount: totals.aicGrossAmount + product.aicGrossAmount,
      }), { ...emptyCosts(), date, products });
    });
    const dailyModels: DetailDailyModelRow[] = [];
    const dailyModelTotals = new Map<string, Record<string, number>>();
    for (const [date, models] of compact.dailyModels) {
      const totals: Record<string, number> = Object.create(null);
      dailyModelTotals.set(date, totals);
      for (const [model, bucket] of models) {
        totals[model] = bucket.quantity;
        const [input, read, write, reportedRows, totalRows] = bucket.cache;
        const total = input + read + write;
        const cacheSuccessRate = reportedRows > 0 && total > 0
          ? { percent: read / total * 100, reportedRows, totalRows } : undefined;
        for (const [costCenter, costs] of bucket.costs) {
          dailyModels.push({
            date, model, costCenter: costCenter || undefined,
            credits: costs[0], gross: costs[1], discount: costs[2], net: costs[3],
            aicGrossAmount: costs[4], isFirstInDate: false, rowSpan: 1,
            ...(cacheSuccessRate ? { cacheSuccessRate } : {}),
          });
        }
      }
    }
    dailyModels.sort((a, b) =>
      a.date.localeCompare(b.date) || a.model.localeCompare(b.model) ||
      (a.costCenter ?? '').localeCompare(b.costCenter ?? ''));
    const dateSpans = new Map<string, number>();
    for (const row of dailyModels) dateSpans.set(row.date, (dateSpans.get(row.date) ?? 0) + 1);
    const seenDates = new Set<string>();
    for (const row of dailyModels) {
      row.rowSpan = dateSpans.get(row.date)!;
      row.isFirstInDate = !seenDates.has(row.date);
      seenDates.add(row.date);
    }
    return {
      hasBillingData: compact.hasBillingData, models: [...compact.consumption.creditsByModel.keys()].sort(),
      header: compact.header, consumption: compact.consumption,
      totals: compact.totals, productCosts: getPopulatedProductCosts(compact.products), dailyRows, dailyModels,
      costCenterCosts: [...compact.costCenters.values()].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)),
      userRows: [...compact.users.values()].sort((a, b) => b.net - a.net || b.quantity - a.quantity || a.user.localeCompare(b.user)),
      dailyModelTotals, dailyConsumption: [...compact.dailyConsumption.values()],
    };
}

export function selectDetailTimeline(details: DetailArtifacts, reportMonth: string | undefined) {
  const dates = buildBillingMonthDates(reportMonth);
  const byDay = new Map(details.dailyConsumption.map(day => [day.date, day]));
  let cumulative = 0;
  const userDailyData = details.models.length === 0 ? [] : dates.map(date => {
    const point: { date: string; totalCumulative: number; [model: string]: string | number } = {
      date, totalCumulative: 0,
    };
    for (const model of details.models) {
      const quantity = details.dailyModelTotals.get(date)?.[model] ?? 0;
      point[model] = quantity;
      cumulative += quantity;
    }
    point.totalCumulative = cumulative;
    return point;
  });
  return {
    userDailyData,
    dailyConsumption: byDay.size === 0 ? [] : dates.map(date =>
      byDay.get(date) ?? { date, included: 0, additional: 0 }),
  };
}
