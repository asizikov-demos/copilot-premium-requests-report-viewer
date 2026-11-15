import { deserialize, serialize } from 'node:v8';

import { PRICING } from '@/constants/pricing';
import { aggregateAutoModeSavings, getAutoModeBaseModel } from '@/utils/autoModeSavings';
import { aggregateDailyConsumption, buildDailyConsumptionRows } from '@/utils/dailyConsumption';
import { buildBillingMonthDates } from '@/utils/dateKeys';
import {
  BillingAggregator, DailyBucketsAggregator, UsageAggregator, buildDailyModelUsageFromArtifacts,
  ModelDailyAggregator, MODEL_BUCKETS,
} from '@/utils/ingestion';
import { createAggregators } from '@/utils/ingestion/registry';
import { REPORT_AGGREGATOR_IDS } from '@/utils/ingestion/streamFile';
import type { Aggregator, NormalizedRow } from '@/utils/ingestion/types';
import { classifyProductCategory, getProductDisplayLabel } from '@/utils/productClassification';
import { aggregateProductCosts, PRODUCT_CATEGORY_ORDER } from '@/utils/productCosts';

import { makeNormalizedRow } from '../helpers/makeNormalizedRow';
import { makeModelDailyArtifacts } from '../helpers/modelDailyArtifacts';

const rows = [
  makeNormalizedRow({ day: '2026-07-14', model: 'Auto: test-model-one', quantity: 30, billingQuantity: 15,
    grossAmount: 0.5, discountAmount: 0.25, aicGrossAmount: 0 }),
  makeNormalizedRow({ day: '2026-07-30', model: 'Auto: test-model-two', quantity: 20,
    grossAmount: 1, discountAmount: 2, organization: 'test-org-one', costCenter: 'test-cost-center-one' }),
  makeNormalizedRow({ day: '2026-07-03', model: 'Auto: test-model-one', quantity: 10, grossAmount: 0.5, netAmount: 0.125 }),
  makeNormalizedRow({ day: '2026-07-30', model: 'Auto: test-model-one', quantity: 15,
    grossAmount: 0.5, netAmount: 0, aicGrossAmount: 0.25 }),
  makeNormalizedRow({ day: '2026-07-14', user: 'test-user-two', model: 'auto: test-model-one', quantity: 5,
    grossAmount: 0, netAmount: -0.125, aicGrossAmount: 0 }),
  makeNormalizedRow({ day: '2026-07-03', user: 'test-user-two', model: 'Fusion (High): test-model-one',
    quantity: 40, netAmount: 0.25, aicGrossAmount: 0.5 }),
  makeNormalizedRow({ day: '2026-07-14', user: '', isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit',
    model: 'Fusion (High): test-model-one', quantity: 5, inputTokens: 10 }),
  makeNormalizedRow({ day: '2026-07-14', model: 'Fusion (Max): test-model-three', quantity: 0, inputTokens: 0 }),
  makeNormalizedRow({ day: '2026-07-30', model: 'test-model-three', sku: 'coding_agent_ai_credit', quantity: 4,
    grossAmount: 0.25, netAmount: 0.25 }),
  makeNormalizedRow({ day: '2026-07-03', model: 'Code Review', quantity: 2, product: 'code_quality', grossAmount: 0.25 }),
];

function run<T>(aggregator: Aggregator<T>, input: NormalizedRow[]): T {
  const ctx = { pricing: PRICING };
  aggregator.init?.(ctx);
  for (const row of input) aggregator.onRow(row, ctx);
  return aggregator.finalize(ctx);
}

function metrics(consumption: number, grossAmount: number, additionalUsage: number) {
  const additionalCredits = Math.min(consumption, additionalUsage / PRICING.AI_CREDIT_USD_VALUE);
  return { consumption, includedCredits: Math.max(consumption - additionalCredits, 0), additionalCredits, grossAmount, additionalUsage };
}

// Frozen row-scan oracle: preserve the pre-migration page calculations independently of the aggregators.
function legacyView(input: NormalizedRow[]) {
  const dates = buildBillingMonthDates(input[0]?.day.slice(0, 7));
  const models = [...new Set(input.map(row => row.model))].sort();
  const products = PRODUCT_CATEGORY_ORDER.map(category => {
    const selected = input.filter(row => classifyProductCategory(row.model, row.product, row.sku) === category);
    return {
      category, label: getProductDisplayLabel(category),
      credits: selected.reduce((sum, row) => sum + row.quantity, 0),
      gross: selected.reduce((sum, row) => sum + (row.grossAmount ?? 0), 0),
      discount: selected.reduce((sum, row) => sum + (row.discountAmount ?? 0), 0),
      net: selected.reduce((sum, row) => sum + (row.netAmount ?? 0), 0),
      aicQuantity: selected.reduce((sum, row) => sum + (row.aicQuantity ?? 0), 0),
      aicGrossAmount: selected.reduce((sum, row) => sum + (row.aicGrossAmount ?? 0), 0),
    };
  }).filter(product => product.credits > 0 || product.gross !== 0 || product.discount !== 0 || product.net !== 0);
  const auto = new Map<string, { model: string; quantity: number; costBeforeAuto: number; savings: number }>();
  for (const row of input) {
    const model = getAutoModeBaseModel(row.model);
    if (!model || row.grossAmount === undefined) continue;
    const before = row.grossAmount / (1 - PRICING.AUTO_MODE_DISCOUNT_RATE);
    const target = auto.get(model) ?? { model, quantity: 0, costBeforeAuto: 0, savings: 0 };
    target.quantity += row.billingQuantity ?? row.quantity;
    target.costBeforeAuto += before;
    target.savings += before - row.grossAmount;
    auto.set(model, target);
  }
  const buckets = MODEL_BUCKETS.map(({ prefix }) => {
    const selected = input.filter(row => row.model.toLowerCase().startsWith(prefix.toLowerCase()));
    const names = [...new Set(selected.map(row => row.model.slice(prefix.length).trim()))];
    return {
      users: new Set(selected.filter(row => row.user.trim() && !row.isUnattributedUsage).map(row => row.user)).size,
      models: names.map(model => {
        const matching = selected.filter(row => row.model.slice(prefix.length).trim() === model);
        return { model, credits: matching.reduce((sum, row) => sum + row.quantity, 0),
          grossAmount: matching.reduce((sum, row) => sum + (row.aicGrossAmount ?? row.quantity * PRICING.AI_CREDIT_USD_VALUE), 0) };
      }).sort((a, b) => a.model.localeCompare(b.model)),
    };
  });
  const dailyRows = dates.map(date => {
    const selected = input.filter(row => row.day === date);
    const modelRows = models.map(model => {
      const matching = selected.filter(row => row.model === model);
      return { model, ...metrics(
        matching.reduce((sum, row) => sum + row.quantity, 0),
        matching.reduce((sum, row) => sum + (row.aicGrossAmount ?? row.quantity * PRICING.AI_CREDIT_USD_VALUE), 0),
        matching.reduce((sum, row) => sum + (row.netAmount ?? (
          row.grossAmount === undefined ? 0 : Math.max(row.grossAmount - (row.discountAmount ?? 0), 0)
        )), 0)
      ) };
    }).filter(row => row.consumption > 0)
      .sort((a, b) => b.consumption - a.consumption || a.model.localeCompare(b.model));
    return { date, models: modelRows, ...metrics(
      selected.reduce((sum, row) => sum + row.quantity, 0),
      modelRows.reduce((sum, row) => sum + row.grossAmount, 0),
      modelRows.reduce((sum, row) => sum + row.additionalUsage, 0)
    ) };
  });
  const hasMoney = input.some(row => row.discountAmount !== undefined || row.netAmount !== undefined);
  return {
    rowCount: input.length, products, auto: [...auto.values()].sort((a, b) => b.savings - a.savings), buckets, dailyRows,
    daily: hasMoney ? dates.map(date => ({
      date,
      included: input.filter(row => row.day === date).reduce((sum, row) => sum + (row.discountAmount ?? 0), 0),
      additional: input.filter(row => row.day === date).reduce((sum, row) => sum + (row.netAmount ?? 0), 0),
    })) : [],
  };
}

function approximate(value: unknown): unknown {
  if (typeof value === 'number') return expect.closeTo(value, 10);
  if (Array.isArray(value)) return value.map(approximate);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, approximate(child)]));
  }
  return value;
}

describe('single-month model and daily page parity', () => {
  it.each([rows, []])('matches the previous row-based views for %j', (...selected) => {
      const artifacts = makeModelDailyArtifacts(selected);
      const before = deserialize(serialize(artifacts));
      const page = artifacts;
      const usage = run(new UsageAggregator(), selected);
      const daily = run(new DailyBucketsAggregator(), selected);
      const billing = run(new BillingAggregator(), selected);
      const data = buildDailyModelUsageFromArtifacts(daily, usage);
      const actual = {
        rowCount: page.rowCount,
        products: aggregateProductCosts(page.productCosts),
        auto: aggregateAutoModeSavings(page.autoModeSavings),
        buckets: page.buckets.map(bucket => ({ users: bucket.users.size,
          models: [...bucket.models].map(([model, amounts]) => ({ model, ...amounts })).sort((a, b) => a.model.localeCompare(b.model)) })),
        dailyRows: buildDailyConsumptionRows(data, Object.keys(usage.modelTotals).sort(), page.commercialByDay),
        daily: aggregateDailyConsumption(page.dailyConsumption, selected[0]?.day.slice(0, 7)),
      };
      expect(actual).toEqual(approximate(legacyView(selected)));
      for (const [model, credits] of Object.entries(usage.modelTotals)) {
        expect(credits).toBe(selected.filter(row => row.model === model).reduce((sum, row) => sum + row.quantity, 0));
        expect(billing.billingByModel.get(model)?.net ?? 0)
          .toBeCloseTo(selected.filter(row => row.model === model).reduce((sum, row) => sum + (row.netAmount ?? 0), 0));
      }
      expect(artifacts).toEqual(before);
    }
  );

  it('keeps global metadata and stable ties in source order', () => {
    const artifacts = makeModelDailyArtifacts(rows);
    expect(artifacts).toMatchObject({ hasOrganizations: true, hasCostCenters: true, rowCount: rows.length });
    expect([...artifacts.commercialByDay.keys()]).toEqual(['2026-07-14', '2026-07-30', '2026-07-03']);
    expect(artifacts.buckets[0].users.size).toBe(2);
    expect(artifacts.buckets[2].users.size).toBe(1);
    const tied = makeModelDailyArtifacts([
      { day: '2026-06-30', model: 'Auto: test-model-one', grossAmount: 1 },
      { day: '2026-06-01', model: 'Auto: test-model-two', grossAmount: 1 },
      { day: '2026-06-30', model: 'Auto: test-model-three', grossAmount: 1 },
    ]);
    expect(aggregateAutoModeSavings(tied.autoModeSavings).map(row => row.model))
      .toEqual(['test-model-one', 'test-model-two', 'test-model-three']);
  });

  it('retains aggregate cardinality rather than rows and survives the worker serialization boundary', () => {
    const aggregator = new ModelDailyAggregator();
    const row = makeNormalizedRow({ model: 'Auto: test-model-one', quantity: 2, grossAmount: 0 });
    for (let index = 0; index < 20000; index++) aggregator.onRow(row);
    row.quantity = 999;
    const artifacts = deserialize(serialize(aggregator.finalize())) as ReturnType<typeof aggregator.finalize>;
    expect(artifacts.rowCount).toBe(20000);
    expect(artifacts.commercialByDay.size).toBe(1);
    expect(artifacts.commercialByDay.get('2025-06-01')?.size).toBe(1);
    expect(artifacts.buckets[0].models.size).toBe(1);
    expect(artifacts.buckets[0].users.size).toBe(1);
    expect(artifacts.buckets[0].models.get('test-model-one')?.credits).toBe(40000);
    expect(aggregateAutoModeSavings(artifacts.autoModeSavings)[0]).toMatchObject({ quantity: 40000, savings: 0 });
    expect(createAggregators(REPORT_AGGREGATOR_IDS).some(registered => registered.id === 'modelDaily')).toBe(true);
  });
});
