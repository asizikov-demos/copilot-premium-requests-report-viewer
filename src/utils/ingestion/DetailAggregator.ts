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
  months: string[];
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
export class DetailAggregator implements Aggregator<DetailArtifacts> {
  readonly id = 'details';
  private header = new UserHeaderAccumulator();
  private totals = emptyCosts();
  private products = createEmptyProductCostMap();
  private dailyProducts = new Map<string, ReturnType<typeof createEmptyProductCostMap>>();
  private costCenters = new Map<string, CostTotals & { name: string }>();
  private users = new Map<string, CostTotals & { user: string }>();
  private models = new Set<string>();
  private months = new Set<string>();
  private dailyModels = new Map<string, DetailDailyModelRow>();
  private dailyModelTotals = new Map<string, Record<string, number>>();
  private cache = new Map<string, { input: number; read: number; write: number; reportedRows: number; totalRows: number }>();
  private dailyConsumption = new Map<string, DailyConsumptionDatum>();
  private credits: CreditTotals = { rowCount: 0, reportedRows: 0 };
  private creditsByModel = new Map<string, CreditTotals>();
  private hasBillingData = false;

  onRow(row: NormalizedRow): void {
    const monthKey = row.day.slice(0, 7);
    this.header.add({ ...row, monthKey, dateKey: row.day, creditsUsed: row.quantity });
    this.months.add(monthKey);
    this.models.add(row.model);
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
    const key = JSON.stringify([row.day, row.model, row.costCenter ?? '']);
    const model = this.dailyModels.get(key) ?? {
      date: row.day, model: row.model, costCenter: row.costCenter,
      credits: 0, gross: 0, discount: 0, net: 0, aicGrossAmount: 0, isFirstInDate: false, rowSpan: 1,
    };
    model.credits += row.quantity;
    model.gross += row.grossAmount ?? 0;
    model.discount += row.discountAmount ?? 0;
    model.net += row.netAmount ?? 0;
    model.aicGrossAmount += row.aicGrossAmount ?? 0;
    this.dailyModels.set(key, model);
    const daily = this.dailyModelTotals.get(row.day) ?? {};
    daily[row.model] = (daily[row.model] ?? 0) + row.quantity;
    this.dailyModelTotals.set(row.day, daily);
    const cacheKey = JSON.stringify([row.day, row.model]);
    const cache = this.cache.get(cacheKey) ?? { input: 0, read: 0, write: 0, reportedRows: 0, totalRows: 0 };
    cache.totalRows++;
    if (row.inputTokens !== undefined && row.cacheReadTokens !== undefined && row.cacheWriteTokens !== undefined) {
      cache.input += row.inputTokens;
      cache.read += row.cacheReadTokens;
      cache.write += row.cacheWriteTokens;
      cache.reportedRows++;
    }
    this.cache.set(cacheKey, cache);
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

  finalize(): DetailArtifacts {
    const sortedDays = [...this.dailyProducts.keys()].sort();
    const dailyRows = sortedDays.length === 0 ? [] : enumerateDatesInclusive(sortedDays[0], sortedDays.at(-1)!).map(date => {
      const bucket = this.dailyProducts.get(date);
      const products = bucket ? getPopulatedProductCosts(bucket) : [];
      return products.reduce((totals, product) => ({
        ...totals, quantity: totals.quantity + product.credits,
        gross: totals.gross + product.gross, discount: totals.discount + product.discount,
        net: totals.net + product.net, aicGrossAmount: totals.aicGrossAmount + product.aicGrossAmount,
      }), { ...emptyCosts(), date, products });
    });
    const dailyModels = [...this.dailyModels.values()].sort((a, b) =>
      a.date.localeCompare(b.date) || a.model.localeCompare(b.model) ||
      (a.costCenter ?? '').localeCompare(b.costCenter ?? ''));
    const dateSpans = new Map<string, number>();
    for (const row of dailyModels) dateSpans.set(row.date, (dateSpans.get(row.date) ?? 0) + 1);
    const seenDates = new Set<string>();
    for (const row of dailyModels) {
      row.rowSpan = dateSpans.get(row.date)!;
      row.isFirstInDate = !seenDates.has(row.date);
      seenDates.add(row.date);
      const cache = this.cache.get(JSON.stringify([row.date, row.model]))!;
      const total = cache.input + cache.read + cache.write;
      if (cache.reportedRows > 0 && total > 0) {
        row.cacheSuccessRate = {
          percent: cache.read / total * 100, reportedRows: cache.reportedRows, totalRows: cache.totalRows,
        };
      }
    }
    return {
      hasBillingData: this.hasBillingData, models: [...this.models].sort(), months: [...this.months].sort(),
      header: this.header.finalize(), consumption: { credits: this.credits, creditsByModel: this.creditsByModel },
      totals: this.totals, productCosts: getPopulatedProductCosts(this.products), dailyRows, dailyModels,
      costCenterCosts: [...this.costCenters.values()].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)),
      userRows: [...this.users.values()].sort((a, b) => b.net - a.net || b.quantity - a.quantity || a.user.localeCompare(b.user)),
      dailyModelTotals: this.dailyModelTotals, dailyConsumption: [...this.dailyConsumption.values()],
    };
  }
}

export function selectDetailTimeline(details: DetailArtifacts, months: readonly string[]) {
  const dates = buildBillingMonthDates(months);
  const byDay = new Map(details.dailyConsumption.map(day => [day.date, day]));
  let cumulative = 0;
  let month = '';
  const userDailyData = details.models.length === 0 ? [] : dates.map(date => {
    if (date.slice(0, 7) !== month) {
      month = date.slice(0, 7);
      cumulative = 0;
    }
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
