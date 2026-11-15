import { makeDailyBucketsArtifacts } from './makeArtifacts';

describe('makeDailyBucketsArtifacts', () => {
  it('creates a complete empty artifact shape', () => {
    const artifacts = makeDailyBucketsArtifacts();

    expect(artifacts).toEqual({
      dailyUserTotals: new Map(),
      dailyUserModelTotals: new Map(),
      dailyBucketTotals: new Map(),
      dailyBucketModelTotals: new Map(),
      dateRange: null,
    });
  });

  it('supports explicit UTC date ranges for empty fixtures', () => {
    const artifacts = makeDailyBucketsArtifacts([], {
      dateRange: { min: '2025-06-01', max: '2025-06-30' },
    });

    expect(artifacts.dateRange).toEqual({ min: '2025-06-01', max: '2025-06-30' });
  });
});
