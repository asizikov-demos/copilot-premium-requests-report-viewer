import { filterDailySeriesByMonths } from '@/utils/analytics/filters';
import { buildMonthListFromArtifacts } from '@/utils/ingestion';

import { makeUsageRow } from '../helpers/makeNormalizedRow';
import { buildDailyBucketsArtifactsFromRows, selectArtifacts } from '../helpers/normalizedArtifacts';

describe('analytics month filters', () => {
  const rows = [
    makeUsageRow({ day: '2025-07-01', quantity: 2 }),
    makeUsageRow({ day: '2025-06-30', quantity: 3 }),
    makeUsageRow({ day: '2025-07-15', quantity: 4 }),
  ];

  it('uses shared month labels for distinct UTC artifact months', () => {
    expect(buildMonthListFromArtifacts(buildDailyBucketsArtifactsFromRows(rows))).toEqual([
      { value: '2025-06', label: 'June 2025' },
      { value: '2025-07', label: 'July 2025' },
    ]);
  });

  it('selects UTC month partitions instead of cached row dates', () => {
    const june = selectArtifacts(rows, ['2025-06']);
    expect([...june.dailyBucketsArtifacts.dailyUserTotals.keys()]).toEqual(['2025-06-30']);
    expect(june.usageArtifacts.users[0].totalCredits).toBe(3);
    expect(selectArtifacts(rows, []).usageArtifacts.users[0].totalCredits).toBe(9);
    expect(selectArtifacts(rows, ['2025-08']).usageArtifacts.users).toEqual([]);
  });

  it('filters daily series by the UTC date string month key', () => {
    const june = { date: '2025-06-30', value: 1 };
    const july = { date: '2025-07-01', value: 2 };
    expect(filterDailySeriesByMonths([june, july], ['2025-06'])).toEqual([june]);
    expect(filterDailySeriesByMonths([june, july], [])).toEqual([june, july]);
  });
});
