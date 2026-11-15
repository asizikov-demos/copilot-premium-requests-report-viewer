/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isMap, isSet } from 'node:util/types';

import Papa from 'papaparse';

import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';
import {
  BillingAggregator, BillingPagesAggregator, DailyBucketsAggregator, FeatureUsageAggregator, QuotaAggregator,
  TokenAggregator, TokenAccumulator, UsageAccumulator, UsageAggregator, buildProcessedDataFromRows,
  buildBillingArtifactsFromProcessedData,
  buildDailyCumulativeDataFromArtifacts, buildDailyModelUsageFromArtifacts,
  mergeUsageArtifacts, mergeQuotaArtifacts, mergeDailyBucketsArtifacts,
  mergeFeatureUsageArtifacts, mergeBillingArtifacts, mergeTokenArtifacts,
  normalizeRow, selectCoreArtifacts,
  type Aggregator, type CoreArtifacts, type MonthlyAggregates, type NormalizedRow,
} from '@/utils/ingestion';
import { buildBillingMonthDates } from '@/utils/dateKeys';

import {
  buildDailyBucketsArtifactsFromProcessedData, buildFeatureUsageArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
} from '../helpers/processedArtifacts';
import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

const ctx = { pricing: PRICING };

function aggregate<T>(aggregator: Aggregator<T>, rows: NormalizedRow[]): T {
  aggregator.init?.(ctx);
  for (const row of rows) aggregator.onRow(row, ctx);
  return aggregator.finalize(ctx);
}

function ingest(rows: NormalizedRow[]): MonthlyAggregates {
  return {
    billingPages: aggregate(new BillingPagesAggregator(), rows),
    usage: aggregate(new UsageAggregator(), rows),
    quota: aggregate(new QuotaAggregator(), rows),
    dailyBuckets: aggregate(new DailyBucketsAggregator(), rows),
    featureUsage: aggregate(new FeatureUsageAggregator(), rows),
    billing: aggregate(new BillingAggregator(), rows),
    tokens: aggregate(new TokenAggregator(), rows),
  };
}

function parse(csv: string): NormalizedRow[] {
  const parsed = Papa.parse<CSVData>(csv, { header: true, skipEmptyLines: true });
  expect(parsed.errors).toEqual([]);
  const warnings: string[] = [];
  const rows = parsed.data.map(row => normalizeRow(row, warnings));
  expect(warnings).toEqual([]);
  return rows.filter((row): row is NormalizedRow => row !== null);
}

function reference(rows: NormalizedRow[]): CoreArtifacts {
  const processed = buildProcessedDataFromRows(rows);
  const usage = new UsageAccumulator();
  const tokens = new TokenAccumulator();
  for (const row of rows) {
    usage.addRow(row);
    tokens.addRow(row);
  }
  return {
    usageArtifacts: usage.finalize(),
    quotaArtifacts: buildQuotaArtifactsFromProcessedData(processed),
    dailyBucketsArtifacts: buildDailyBucketsArtifactsFromProcessedData(processed),
    featureUsageArtifacts: buildFeatureUsageArtifactsFromProcessedData(processed),
    billingArtifacts: buildBillingArtifactsFromProcessedData(processed),
    tokenArtifacts: tokens.finalize(),
  };
}

// Ignore transport/provenance metadata and harmless floating-point grouping differences.
function comparable(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toPrecision(12));
  if (isMap(value)) return new Map([...value].map(([key, entry]) => [key, comparable(entry)]));
  if (isSet(value)) return new Set([...value].map(comparable));
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['byMonth', 'mergeOrder', 'observations', 'userOrder'].includes(key))
      .map(([key, entry]) => [key, comparable(entry)]));
  }
  return value;
}

const quota = PRICING.BUSINESS_AI_CREDIT_QUOTA;
const enterpriseQuota = PRICING.ENTERPRISE_AI_CREDIT_QUOTA;
const fixture = `date,username,product,sku,model,quantity,unit_type,total_monthly_quota,organization,cost_center_name,gross_amount,discount_amount,net_amount,aic_quantity,aic_gross_amount,input,output,cache_read,cache_write
2026-06-30T23:59:59Z,test-user-one,copilot,coding_agent_ai_credit,test-model-one,2.5,ai-credits,${quota},test-org-one,test-cost-center-one,0.25,0.125,0.125,2.5,0.25,100,20,0,
2026-08-01,test-user-one,copilot,copilot_ai_credit,test-model-two,3,ai-credits,${enterpriseQuota},test-org-two,test-cost-center-two,0.5,0,0.5,3,0.5,0,,50,0
2026-07-01,test-user-two,copilot,copilot_ai_credit,Code Review model,4,ai-credits,${quota},test-org-one,test-cost-center-one,,,,,,25,0,,
2026-06-15,,copilot,copilot_ai_credit,Code Review model,1,ai-credits,${quota},test-org-one,,0.125,0.125,0,1,0.125,10,,,
2026-08-02,test-user-one,copilot,coding_agent_ai_credit,test-model-one,0.5,ai-credits,${quota},test-org-two,test-cost-center-two,0.125,0,0.125,0.5,0.125,,,,
2026-07-02,test-user-one,copilot,copilot_ai_credit,test-model-two,1,ai-credits,${quota},test-org-one,test-cost-center-one,,,,,,,,,
2026-06-30,test-user-two,copilot,copilot_ai_credit,test-model-two,2,ai-credits,${quota},test-org-one,test-cost-center-one,,,,,,,,,
2026-07-12,test-user-two,spark,spark_ai_credit,test-model-three,1,ai-credits,${quota},test-org-one,test-cost-center-one,,,,,,,,,
2026-08-03,,code_quality,code_quality_ai_credit,test-model-four,0.5,ai-credits,,test-org-two,,0.125,0,0.125,,,,,,`;
const rows = parse(fixture);

describe('month-keyed core aggregates', () => {
  it.each([
    ['all months', []],
    ['one month', ['2026-06']],
    ['non-adjacent subset', ['2026-08', '2026-06']],
    ['duplicate months', ['2026-06', '2026-06']],
    ['absent month', ['2026-09']],
  ])('matches row-based artifacts for %s after structured clone', (_name, selectedMonths) => {
    const aggregates = ingest(rows);
    const transferred = structuredClone(aggregates);
    const before = structuredClone(transferred);
    const selected = selectCoreArtifacts(transferred, selectedMonths);
    const filteredRows = selectedMonths.length
      ? rows.filter(row => selectedMonths.includes(row.day.slice(0, 7)))
      : rows;
    expect(comparable(selected)).toEqual(comparable(reference(filteredRows)));
    expect(transferred).toEqual(before);
    if (selectedMonths.length === 0) {
      expect(selected.usageArtifacts).toBe(transferred.usage);
      expect(selected.billingArtifacts).toBe(transferred.billing);
    }
  });

  it('merges all month partials to the same totals as the original stream', () => {
    const aggregates = ingest(rows);
    const merged: CoreArtifacts = {
      usageArtifacts: mergeUsageArtifacts([...aggregates.usage.byMonth.values()]),
      quotaArtifacts: mergeQuotaArtifacts([...aggregates.quota.byMonth.values()]),
      dailyBucketsArtifacts: mergeDailyBucketsArtifacts([...aggregates.dailyBuckets.byMonth.values()]),
      featureUsageArtifacts: mergeFeatureUsageArtifacts([...aggregates.featureUsage.byMonth.values()]),
      billingArtifacts: mergeBillingArtifacts([...aggregates.billing!.byMonth.values()]),
      tokenArtifacts: mergeTokenArtifacts([...aggregates.tokens!.byMonth.values()]),
    };
    expect(comparable(merged)).toEqual(comparable(reference(rows)));
    expect(merged.usageArtifacts.users[0].topModel).toBe('test-model-two');
    expect(merged.quotaArtifacts.conflicts.get('test-user-one')).toEqual(new Set([quota, enterpriseQuota]));
  });

  it('uses selected billing months for full-day timelines and monthly cumulative resets', () => {
    const selected = selectCoreArtifacts(ingest(rows), ['2026-06', '2026-08']);
    const dates = buildBillingMonthDates(['2026-06', '2026-08']);
    const cumulative = buildDailyCumulativeDataFromArtifacts(selected.dailyBucketsArtifacts);
    const models = buildDailyModelUsageFromArtifacts(selected.dailyBucketsArtifacts, selected.usageArtifacts);
    expect(cumulative.map(day => day.date)).toEqual(dates);
    expect(models.map(day => day.date)).toEqual(dates);
    expect(cumulative.find(day => day.date === '2026-06-29')?.['test-user-one']).toBe(0);
    expect(cumulative.find(day => day.date === '2026-06-30')?.['test-user-one']).toBe(2.5);
    expect(cumulative.find(day => day.date === '2026-08-01')?.['test-user-one']).toBe(3);
    expect(selected.tokenArtifacts?.byDay.get('2026-08-02')?.totals.inputTokens).toBeUndefined();
    expect(selected.tokenArtifacts?.byDay.get('2026-08-01')?.totals.inputTokens).toBe(0);
  });

  it('preserves source-order metadata and tied top models for interleaved months and zero rows', () => {
    const source = [
      makeNormalizedRow({ day: '2026-06-01', model: 'test-model-one', quantity: 2 }),
      makeNormalizedRow({ day: '2026-08-01', model: 'test-model-two', quantity: 3, costCenter: 'test-cost-center-one', sku: 'coding_agent_ai_credit' }),
      makeNormalizedRow({ day: '2026-06-02', model: 'test-model-one', quantity: 1, costCenter: 'test-cost-center-two', sku: 'coding_agent_ai_credit' }),
      makeNormalizedRow({ day: '2026-08-02', model: 'test-model-two', quantity: 0 }),
      makeNormalizedRow({ day: '2026-07-01', model: 'test-model-three', quantity: 9 }),
    ];
    const selected = selectCoreArtifacts(ingest(source), ['2026-08', '2026-06']);
    const expected = new UsageAccumulator();
    source.filter(row => row.day.slice(0, 7) !== '2026-07').forEach(row => expected.addRow(row));
    expect(comparable(selected.usageArtifacts)).toEqual(comparable(expected.finalize()));
    expect(selected.usageArtifacts.users[0]).toMatchObject({
      topModel: 'test-model-two', topModelValue: 3, costCenter: 'test-cost-center-one',
      codingAgentModels: ['test-model-two', 'test-model-one'],
    });
  });

  it('rejects unsafe token totals across separate month partitions', () => {
    const aggregator = new TokenAggregator();
    aggregator.onRow(makeNormalizedRow({ day: '2026-06-01', inputTokens: Number.MAX_SAFE_INTEGER }));
    expect(() => aggregator.onRow(makeNormalizedRow({ day: '2026-07-01', inputTokens: 1 })))
      .toThrow('Token total exceeds the safe integer range');
    expect(() => aggregator.finalize()).toThrow('Token total exceeds the safe integer range');
  });

  it.each(['constructor', 'toString', '__proto__'])('preserves numeric usage for the model key %s', model => {
    const source = [
      makeNormalizedRow({ day: '2026-06-01', model, quantity: 2 }),
      makeNormalizedRow({ day: '2026-06-01', model, quantity: 3, user: '', isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit' }),
      makeNormalizedRow({ day: '2026-07-01', model, quantity: 5 }),
      makeNormalizedRow({ day: '2026-07-01', model, quantity: 7, user: '', isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit' }),
    ];
    const aggregates = structuredClone(ingest(source));
    for (const [months, userCredits, bucketCredits] of [
      [[], 7, 10],
      [['2026-06'], 2, 3],
      [['2026-07'], 5, 7],
      [['2026-06', '2026-07'], 7, 10],
    ] as const) {
      const { usageArtifacts } = selectCoreArtifacts(aggregates, months);
      expect(usageArtifacts.modelTotals[model]).toBe(userCredits + bucketCredits);
      expect(usageArtifacts.users[0].modelBreakdown[model]).toBe(userCredits);
      expect(usageArtifacts.users[0]).toMatchObject({ topModel: model, topModelValue: userCredits });
      expect(usageArtifacts.specialBuckets?.[0].modelBreakdown[model]).toBe(bucketCredits);
    }
  });

  it('does not turn a failed or absent token artifact into a successful empty result', () => {
    const aggregates = ingest(rows);
    expect(selectCoreArtifacts({ ...aggregates, tokens: null }, ['2026-06']).tokenArtifacts).toBeNull();
    expect(selectCoreArtifacts({ ...aggregates, tokens: undefined }, ['2026-06']).tokenArtifacts).toBeUndefined();
  });

  it('matches token-only CSVs with absent commercial and quota columns', () => {
    const tokenOnly = parse(`date,username,sku,model,quantity,input
2026-06-30,test-user-one,copilot_ai_credit,test-model-one,1,100
2026-07-01,test-user-one,copilot_ai_credit,test-model-one,2,0
2026-08-01,test-user-two,copilot_ai_credit,test-model-two,3,`);
    const aggregates = ingest(tokenOnly);
    for (const months of [[], ['2026-06'], ['2026-06', '2026-08']]) {
      const selectedRows = months.length ? tokenOnly.filter(row => months.includes(row.day.slice(0, 7))) : tokenOnly;
      expect(comparable(selectCoreArtifacts(aggregates, months))).toEqual(comparable(reference(selectedRows)));
    }
  });

  it('matches billing and token totals for the checked-in sample CSV', () => {
    const sample = parse(readFileSync(path.join(process.cwd(), 'public/data/ai-credits-example.csv'), 'utf8'));
    const aggregates = ingest(sample);
    for (const selectedMonths of [[], [sample[0].day.slice(0, 7)]]) {
      const selected = selectCoreArtifacts(aggregates, selectedMonths);
      const filtered = selectedMonths.length ? sample.filter(row => selectedMonths.includes(row.day.slice(0, 7))) : sample;
      expect(comparable(selected)).toEqual(comparable(reference(filtered)));
    }
  });
});
