import { readFileSync } from 'node:fs';
import path from 'node:path';

import Papa from 'papaparse';

import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';
import { aggregateDailyConsumption } from '@/utils/dailyConsumption';
import { buildBillingMonthDates, enumerateDatesInclusive } from '@/utils/dateKeys';
import { normalizeRows } from '../helpers/normalizeRows';
import { buildUserDailyModelDataFromArtifacts } from '@/utils/ingestion/analytics';
import { selectDetailTimeline } from '@/utils/ingestion/DetailAggregator';
import { DetailPagesAggregator, selectUserDetails, selectBillingGroupDetails } from '@/utils/ingestion/DetailPagesAggregator';
import { aggregateProductCosts } from '@/utils/productCosts';
import { summarizeUserHeader } from '@/utils/userHeaderSummary';

import { buildUserHeaderSummary } from '../helpers/detailFixtures';
import { buildDailyBucketsArtifactsFromRows, buildUsageArtifactsFromRows } from '../helpers/normalizedArtifacts';
import { buildUserConsumption } from '../helpers/consumptionReference';
import { makeModelDailyArtifacts } from '../helpers/modelDailyArtifacts';
import { aggregateRows } from '../helpers/aggregateRows';

const csv = readFileSync(path.join(process.cwd(), '__tests__/fixtures/detail-usage.csv'), 'utf8');
const rows = normalizeRows(Papa.parse<CSVData>(csv, { header: true, skipEmptyLines: true }).data);
const filters: { user?: string; organization?: string; costCenter?: string }[] = [
  { user: 'test-user-one' },
  { organization: 'test-org-one' },
  { costCenter: 'test-cost-center-one' },
  { organization: 'Unassigned' },
  { costCenter: 'Unassigned' },
];

const precomputed = aggregateRows(new DetailPagesAggregator(), rows);

describe('precomputed detail views', () => {
  it.each(filters)('matches row-based view models for %j', filter => {
      const periodRows = rows;
      const selected = periodRows.filter(row =>
        (filter.user === undefined || row.user === filter.user) &&
        (filter.organization === undefined || (row.organization || 'Unassigned') === filter.organization) &&
        (filter.costCenter === undefined || (row.costCenter || 'Unassigned') === filter.costCenter));
      const data = filter.user
        ? selectUserDetails(precomputed, filter.user)
        : selectBillingGroupDetails(precomputed, filter.organization ? 'organization' : 'costCenter',
          (filter.organization ?? filter.costCenter)!);
      const { details } = data;
      const reportMonth = '2026-07';
      const modelDaily = makeModelDailyArtifacts(selected);
      expect(details.productCosts).toEqual(aggregateProductCosts(modelDaily.productCosts));
      if ('tokens' in data) expect({ ...details.consumption, tokens: data.tokens }).toEqual(buildUserConsumption(selected));
      expect(selectDetailTimeline(details, reportMonth).dailyConsumption)
        .toEqual(aggregateDailyConsumption(modelDaily.dailyConsumption, reportMonth));
      expect(summarizeUserHeader(details.header, PRICING.BUSINESS_AI_CREDIT_QUOTA, true))
        .toEqual(buildUserHeaderSummary(selected, PRICING.BUSINESS_AI_CREDIT_QUOTA, true));
      expect(details.totals).toEqual(selected.reduce((total, row) => ({
        quantity: total.quantity + row.quantity, gross: total.gross + (row.grossAmount ?? 0),
        discount: total.discount + (row.discountAmount ?? 0), net: total.net + (row.netAmount ?? 0),
        aicGrossAmount: total.aicGrossAmount + (row.aicGrossAmount ?? 0),
      }), { quantity: 0, gross: 0, discount: 0, net: 0, aicGrossAmount: 0 }));
      const activeDates = selected.map(row => row.day).sort();
      const dates = activeDates.length ? enumerateDatesInclusive(activeDates[0], activeDates.at(-1)!) : [];
      expect(details.dailyRows).toEqual(dates.map(date => {
        const products = aggregateProductCosts(makeModelDailyArtifacts(selected.filter(row => row.day === date)).productCosts);
        return {
          date, products,
          quantity: products.reduce((sum, product) => sum + product.credits, 0),
          gross: products.reduce((sum, product) => sum + product.gross, 0),
          discount: products.reduce((sum, product) => sum + product.discount, 0),
          net: products.reduce((sum, product) => sum + product.net, 0),
          aicGrossAmount: products.reduce((sum, product) => sum + product.aicGrossAmount, 0),
        };
      }));
      expect(details.userRows.map(row => row.user).sort())
        .toEqual([...new Set(selected.filter(row => !row.isUnattributedUsage).map(row => row.user))].sort());
      if (filter.user) {
        expect(selectDetailTimeline(details, reportMonth).userDailyData).toEqual(buildUserDailyModelDataFromArtifacts(
          buildDailyBucketsArtifactsFromRows(periodRows), buildUsageArtifactsFromRows(periodRows), filter.user));
      }
    },
  );

  it('combines complete cache counts across cost centers without treating missing counts as zero', () => {
    const { details } = selectUserDetails(precomputed, 'test-user-one');
    expect(details.dailyModels.filter(row => row.date === '2026-07-10')).toEqual([
      expect.objectContaining({ credits: 2, rowSpan: 2, isFirstInDate: true,
        cacheSuccessRate: { percent: 60, reportedRows: 2, totalRows: 3 } }),
      expect.objectContaining({ credits: 4, rowSpan: 2, isFirstInDate: false,
        cacheSuccessRate: { percent: 60, reportedRows: 2, totalRows: 3 } }),
    ]);
    expect(details.dailyModels.find(row => row.date === '2026-07-01')?.cacheSuccessRate).toBeUndefined();
    const timeline = selectDetailTimeline(details, '2026-07').userDailyData;
    expect(timeline.map(row => row.date)).toEqual(buildBillingMonthDates('2026-07'));
    expect(timeline.find(row => row.date === '2026-07-01')?.totalCumulative).toBe(4);
    expect(timeline.find(row => row.date === '2026-07-31')?.totalCumulative).toBe(16);
  });

  it('keeps token-only exports usable and rejects missing detail scopes', () => {
    const tokenCsv = 'date,username,sku,model,quantity,input\n2026-07-01,test-user-one,copilot_ai_credit,test-model-one,1,20';
    const tokenRows = normalizeRows(Papa.parse<CSVData>(tokenCsv, { header: true }).data);
    const artifacts = aggregateRows(new DetailPagesAggregator(), tokenRows);
    const { details, tokens } = selectUserDetails(artifacts, 'test-user-one');
    expect(details.hasBillingData).toBe(false);
    expect(summarizeUserHeader(details.header, 'unknown', false).totalCost).toBeNull();
    expect(tokens.totals.inputTokens).toBe(20);
    expect(() => selectUserDetails(artifacts, 'test-user-two')).toThrow('Missing precomputed details');
    expect(() => selectBillingGroupDetails(artifacts, 'organization', 'test-org-two')).toThrow('Missing precomputed details');
  });

  it('rejects overflowing user token totals across different day/model buckets during ingestion', () => {
    const accumulator = new DetailPagesAggregator();
    accumulator.onRow({ ...rows[0], inputTokens: Number.MAX_SAFE_INTEGER });
    expect(() => accumulator.onRow({ ...rows[0], day: '2026-07-11', model: 'test-model-two', inputTokens: 1 }))
      .toThrow('overflowing detail token total');
    expect(() => accumulator.finalize()).toThrow('overflowing detail token total');
  });
});
