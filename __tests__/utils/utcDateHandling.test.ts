import { normalizeRows } from '../helpers/normalizeRows';
import { createMockCSVData } from '../helpers/testUtils';

describe('UTC billing dates', () => {
  it('preserves source dates as UTC day strings without local conversion', () => {
    const days = ['2025-06-01', '2025-06-15', '2025-06-30'];
    const rows = normalizeRows(days.map(date => createMockCSVData({ date })));
    expect(rows.map(row => row.date)).toEqual(days);
    expect(rows.map(row => row.day)).toEqual(days);
  });

  it('preserves source calendar dates across DST and offset timestamp boundaries', () => {
    const boundaries = normalizeRows([
      createMockCSVData({ date: '2025-03-01T00:00:00+14:00' }),
      createMockCSVData({ date: '2025-03-31T23:59:59-07:00' }),
    ]);
    expect(boundaries.map(row => row.day)).toEqual(['2025-03-01', '2025-03-31']);
  });
});
