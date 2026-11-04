import { aggregateDailyConsumption } from '@/utils/dailyConsumption';
import {
  buildDailyBucketsArtifactsFromProcessedData,
  buildDailyCodeReviewUsageFromArtifacts,
  buildDailyCodingAgentUsageFromArtifacts,
  buildDailyCumulativeDataFromArtifacts,
  buildDailyModelUsageFromArtifacts,
  buildUsageArtifactsFromProcessedData,
  buildUserDailyModelDataFromArtifacts,
} from '@/utils/ingestion';

import { makeProcessedData } from '../helpers/testUtils';

describe('billingMonth series contract', () => {
  const rows = [
    makeProcessedData({ timestamp: new Date('2024-02-20T23:59:59Z'), model: 'Code Review model', creditsUsed: 3, netAmount: 0.3 }),
    makeProcessedData({ timestamp: new Date('2024-02-10T00:00:00Z'), model: 'Coding Agent model', creditsUsed: 2, netAmount: 0.2 }),
    // A report month without this user's or either feature's usage.
    makeProcessedData({ timestamp: new Date('2024-04-15T00:00:00Z'), user: 'test-user-two', model: 'test-model-one', creditsUsed: 1 }),
  ];
  const daily = buildDailyBucketsArtifactsFromProcessedData(rows);
  const usage = buildUsageArtifactsFromProcessedData(rows);
  const expectedDates = [
    ...Array.from({ length: 29 }, (_, index) => `2024-02-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 30 }, (_, index) => `2024-04-${String(index + 1).padStart(2, '0')}`),
  ];
  const series = {
    'USD consumption': () => aggregateDailyConsumption(rows.slice(0, 2), rows),
    'model trends': () => buildDailyModelUsageFromArtifacts(daily, usage),
    'user models': () => buildUserDailyModelDataFromArtifacts(daily, usage, 'test-user-one'),
    'consumption heatmap': () => buildDailyCumulativeDataFromArtifacts(daily),
    'cloud agent (SKU-aware)': () => buildDailyCodingAgentUsageFromArtifacts(daily),
    'cloud agent (model fallback)': () => {
      const { dailyCodingAgentTotals: _totals, ...legacy } = daily;
      void _totals;
      return buildDailyCodingAgentUsageFromArtifacts(legacy);
    },
    'code review': () => buildDailyCodeReviewUsageFromArtifacts(daily),
  };

  it.each(Object.entries(series))('%s covers whole report months including inactive boundary days', (_name, build) => {
    expect(build().map(point => point.date)).toEqual(expectedDates);
    expect(daily.dateRange).toEqual({ min: '2024-02-10', max: '2024-04-15' });
  });

  it('zero-fills daily usage but carries cumulative values until month end and resets next month', () => {
    const agent = buildDailyCodingAgentUsageFromArtifacts(daily);
    expect(agent[0]).toEqual({ date: '2024-02-01', dailyCredits: 0, cumulativeCredits: 0 });
    expect(agent[9]).toEqual({ date: '2024-02-10', dailyCredits: 2, cumulativeCredits: 2 });
    expect(agent[28]).toEqual({ date: '2024-02-29', dailyCredits: 0, cumulativeCredits: 2 });
    expect(agent[29]).toEqual({ date: '2024-04-01', dailyCredits: 0, cumulativeCredits: 0 });
    const user = buildUserDailyModelDataFromArtifacts(daily, usage, 'test-user-one');
    expect(user[28]).toMatchObject({ totalCumulative: 5, 'Code Review model': 0, 'Coding Agent model': 0 });
    expect(user[29]).toMatchObject({ totalCumulative: 0 });
    const heatmap = buildDailyCumulativeDataFromArtifacts(daily);
    expect(heatmap[28]['test-user-one']).toBe(5);
    expect(heatmap[29]['test-user-one']).toBe(0);
    expect(buildDailyModelUsageFromArtifacts(daily, usage)[0].totalCredits).toBe(0);
    expect(aggregateDailyConsumption(rows)[0]).toEqual({ date: '2024-02-01', included: 0, additional: 0 });
  });

  it('derives report months for older artifacts without a month index', () => {
    const legacy = { ...daily, months: undefined };
    expect(buildDailyCumulativeDataFromArtifacts(legacy).map(point => point.date)).toEqual(expectedDates);
    expect(buildUserDailyModelDataFromArtifacts(legacy, usage, 'test-user-one').map(point => point.date)).toEqual(expectedDates);
    expect(buildDailyModelUsageFromArtifacts(legacy, usage).map(point => point.date)).toEqual(expectedDates);
    expect(buildDailyCodingAgentUsageFromArtifacts(legacy).map(point => point.date)).toEqual(expectedDates);
    expect(buildDailyCodeReviewUsageFromArtifacts(legacy).map(point => point.date)).toEqual(expectedDates);
  });
});
