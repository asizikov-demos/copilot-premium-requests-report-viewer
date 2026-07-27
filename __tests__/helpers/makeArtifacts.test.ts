import { makeDailyBucketsArtifacts } from './makeArtifacts';

describe('makeDailyBucketsArtifacts', () => {
  it('creates a complete empty artifact shape', () => {
    const artifacts = makeDailyBucketsArtifacts();

    expect(artifacts).toEqual({
      dailyUserTotals: new Map(),
      dailyUserAicTotals: new Map(),
      dailyUserModelTotals: new Map(),
      dailyUserAicModelTotals: new Map(),
      dailyBucketTotals: new Map(),
      dailyBucketModelTotals: new Map(),
      dateRange: null,
      months: [],
    });
  });

  it('supports explicit UTC date ranges and months for empty fixtures', () => {
    const artifacts = makeDailyBucketsArtifacts([], {
      dateRange: { min: '2025-06-30', max: '2025-07-01' },
      months: ['2025-06', '2025-07'],
    });

    expect(artifacts.dateRange).toEqual({ min: '2025-06-30', max: '2025-07-01' });
    expect(artifacts.months).toEqual(['2025-06', '2025-07']);
  });
});
