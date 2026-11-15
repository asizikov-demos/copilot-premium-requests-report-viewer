import { buildMonthListFromArtifacts } from '@/utils/ingestion';

import { normalizeRows } from '../helpers/normalizeRows';
import { buildDailyBucketsArtifactsFromRows, selectArtifacts } from '../helpers/normalizedArtifacts';
import { createMockCSVData } from '../helpers/testUtils';

describe('UTC billing dates and month selection', () => {
  const days = ['2025-06-30', '2025-07-01', '2025-07-31', '2025-08-01', '2025-12-31'];
  const rows = normalizeRows(days.map(date => createMockCSVData({ date })));

  it('preserves source dates as UTC day strings without local conversion', () => {
    expect(rows.map(row => row.date)).toEqual(days);
    expect(rows.map(row => row.day)).toEqual(days);
  });

  it('identifies distinct billing months with shared labels', () => {
    expect(buildMonthListFromArtifacts(buildDailyBucketsArtifactsFromRows(rows))).toEqual([
      { value: '2025-06', label: 'June 2025' },
      { value: '2025-07', label: 'July 2025' },
      { value: '2025-08', label: 'August 2025' },
      { value: '2025-12', label: 'December 2025' },
    ]);
  });

  it.each([
    { months: ['2025-07'], expected: ['2025-07-01', '2025-07-31'] },
    { months: ['2025-12'], expected: ['2025-12-31'] },
    { months: ['2025-07', '2025-08'], expected: ['2025-07-01', '2025-07-31', '2025-08-01'] },
    { months: [], expected: days },
  ])('selects only UTC days in billing months $months', ({ months, expected }) => {
    const selected = selectArtifacts(rows, months);
    expect([...selected.dailyBucketsArtifacts.dailyUserTotals.keys()]).toEqual(expected);
    expect(selected.usageArtifacts.users[0].totalCredits).toBe(expected.length);
  });

  it('preserves dates across DST and offset timestamp boundaries', () => {
    const boundaries = normalizeRows([
      createMockCSVData({ date: '2025-03-31T23:59:59-07:00' }),
      createMockCSVData({ date: '2025-04-01T00:00:00+14:00' }),
    ]);
    expect(boundaries.map(row => row.day)).toEqual(['2025-03-31', '2025-04-01']);
    expect([...selectArtifacts(boundaries, ['2025-03']).dailyBucketsArtifacts.dailyUserTotals.keys()])
      .toEqual(['2025-03-31']);
    expect([...selectArtifacts(boundaries, ['2025-04']).dailyBucketsArtifacts.dailyUserTotals.keys()])
      .toEqual(['2025-04-01']);
  });
});
