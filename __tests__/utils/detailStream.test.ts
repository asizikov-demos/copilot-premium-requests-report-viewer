import { readFileSync } from 'node:fs';
import path from 'node:path';

import Papa from 'papaparse';

import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';
import { aggregateDailyConsumption } from '@/utils/dailyConsumption';
import { buildBillingMonthDates, enumerateDatesInclusive } from '@/utils/dateKeys';
import { buildProcessedDataFromRawRows } from '@/utils/ingestion/adapters';
import { buildUserDailyModelDataFromArtifacts } from '@/utils/ingestion/analytics';
import { selectDetailTimeline, type DetailArtifacts } from '@/utils/ingestion/DetailAggregator';
import { streamFile } from '@/utils/ingestion/streamFile';
import type { RowFilter, TokenArtifacts } from '@/utils/ingestion/types';
import { aggregateProductCosts } from '@/utils/productCosts';
import { summarizeUserHeader } from '@/utils/userHeaderSummary';

import { buildUserHeaderSummary } from '../helpers/detailFixtures';
import { buildDailyBucketsArtifactsFromProcessedData, buildUsageArtifactsFromProcessedData } from '../helpers/processedArtifacts';
import { buildUserConsumption } from '../helpers/legacyUserConsumption';
import { createStreamingFile, MockFileReader } from '../helpers/streamingFile';
import { makeModelDailyArtifacts } from '../helpers/modelDailyArtifacts';

const csv = readFileSync(path.join(process.cwd(), '__tests__/fixtures/detail-usage.csv'), 'utf8');
const rows = buildProcessedDataFromRawRows(Papa.parse<CSVData>(csv, { header: true, skipEmptyLines: true }).data);
const filters: RowFilter[] = [
  { user: 'test-user-one' },
  { organization: 'test-org-one' },
  { costCenter: 'test-cost-center-one' },
  { organization: 'Unassigned' },
  { costCenter: 'Unassigned' },
];

describe('filtered detail stream parity', () => {
  const originalReader = globalThis.FileReader;
  beforeEach(() => {
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  });
  afterEach(() => {
    globalThis.FileReader = originalReader;
  });
  it.each(filters.flatMap(filter => [[], ['2026-07']].map(months => ({ filter, months }))))(
    'matches row-based view models for $filter, months=$months', async ({ filter, months }) => {
      const periodRows = rows.filter(row => months.length === 0 || months.includes(row.monthKey));
      const selected = periodRows.filter(row =>
        (filter.user === undefined || row.user === filter.user) &&
        (filter.organization === undefined || (row.organization || 'Unassigned') === filter.organization) &&
        (filter.costCenter === undefined || (row.costCenter || 'Unassigned') === filter.costCenter));
      const result = await streamFile(createStreamingFile(csv), ['details', 'tokens'], { ...filter, months }, { chunkSize: 128 });
      expect(result.warnings).toEqual([]);
      expect(result.rowsProcessed).toBe(selected.length);
      const details = result.outputs.details as DetailArtifacts;
      const tokens = result.outputs.tokens as TokenArtifacts;
      const monthKeys = periodRows.map(row => row.monthKey);
      const modelDaily = makeModelDailyArtifacts(selected.map(row => ({ ...row, day: row.dateKey, quantity: row.creditsUsed })));
      expect(details.productCosts).toEqual(aggregateProductCosts(modelDaily.productCosts));
      expect({ ...details.consumption, tokens }).toEqual(buildUserConsumption(selected));
      expect(selectDetailTimeline(details, monthKeys).dailyConsumption)
        .toEqual(aggregateDailyConsumption(modelDaily.dailyConsumption, monthKeys));
      expect(summarizeUserHeader(details.header, PRICING.BUSINESS_AI_CREDIT_QUOTA, true))
        .toEqual(buildUserHeaderSummary(selected, PRICING.BUSINESS_AI_CREDIT_QUOTA, true));
      expect(details.totals).toEqual(selected.reduce((total, row) => ({
        quantity: total.quantity + row.creditsUsed, gross: total.gross + (row.grossAmount ?? 0),
        discount: total.discount + (row.discountAmount ?? 0), net: total.net + (row.netAmount ?? 0),
        aicGrossAmount: total.aicGrossAmount + (row.aicGrossAmount ?? 0),
      }), { quantity: 0, gross: 0, discount: 0, net: 0, aicGrossAmount: 0 }));
      const activeDates = selected.map(row => row.dateKey).sort();
      const dates = activeDates.length ? enumerateDatesInclusive(activeDates[0], activeDates.at(-1)!) : [];
      expect(details.dailyRows).toEqual(dates.map(date => {
        const products = aggregateProductCosts(makeModelDailyArtifacts(selected.filter(row => row.dateKey === date)
          .map(row => ({ ...row, day: row.dateKey, quantity: row.creditsUsed }))).productCosts);
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
        expect(selectDetailTimeline(details, monthKeys).userDailyData).toEqual(buildUserDailyModelDataFromArtifacts(
          buildDailyBucketsArtifactsFromProcessedData(periodRows), buildUsageArtifactsFromProcessedData(periodRows), filter.user));
      }
    },
  );

  it('combines complete cache counts across cost centers without treating missing counts as zero', async () => {
    const result = await streamFile(createStreamingFile(csv), ['details'], { user: 'test-user-one' });
    const details = result.outputs.details as DetailArtifacts;
    expect(details.dailyModels.filter(row => row.date === '2026-06-30')).toEqual([
      expect.objectContaining({ credits: 2, rowSpan: 2, isFirstInDate: true,
        cacheSuccessRate: { percent: 60, reportedRows: 2, totalRows: 3 } }),
      expect.objectContaining({ credits: 4, rowSpan: 2, isFirstInDate: false,
        cacheSuccessRate: { percent: 60, reportedRows: 2, totalRows: 3 } }),
    ]);
    expect(details.dailyModels.find(row => row.date === '2026-07-01')?.cacheSuccessRate).toBeUndefined();
    const timeline = selectDetailTimeline(details, ['2026-06', '2026-07', '2026-08']).userDailyData;
    expect(timeline.map(row => row.date)).toEqual(buildBillingMonthDates(['2026-06', '2026-07', '2026-08']));
    expect(timeline.find(row => row.date === '2026-07-01')?.totalCumulative).toBe(4);
    expect(timeline.find(row => row.date === '2026-08-01')?.totalCumulative).toBe(0);
  });

  it('keeps token-only exports usable and returns no invented activity for no-match filters', async () => {
    const tokenCsv = 'date,username,sku,model,quantity,input\n2026-07-01,test-user-one,copilot_ai_credit,test-model-one,1,20';
    const file = createStreamingFile(tokenCsv);
    const result = await streamFile(file, ['details', 'tokens'], { user: 'test-user-one' });
    const details = result.outputs.details as DetailArtifacts;
    expect(details.hasBillingData).toBe(false);
    expect(summarizeUserHeader(details.header, 'unknown', false).totalCost).toBeNull();
    expect((result.outputs.tokens as TokenArtifacts).totals.inputTokens).toBe(20);
    const empty = await streamFile(file, ['details'], { user: 'test-user-two' });
    expect(selectDetailTimeline(empty.outputs.details as DetailArtifacts, ['2026-07']))
      .toEqual({ userDailyData: [], dailyConsumption: [] });
  });
});
