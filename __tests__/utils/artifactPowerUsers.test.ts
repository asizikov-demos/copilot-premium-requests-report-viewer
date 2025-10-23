import { analyzePowerUsersFromArtifacts, SPECIAL_FEATURES_CONFIG, MAX_SPECIAL_FEATURES_SCORE, calculateSpecialFeaturesScore } from '@/utils/ingestion/analytics';
import { processCSVData } from '../helpers/processCSVData';
import { powerUserCSVData } from '../fixtures/validCSVData';
import type { ProcessedData } from '@/types/csv';
import type { UsageArtifacts } from '@/utils/ingestion/types';
import { createMockCSVData } from '../helpers/testUtils';
import type { CSVData } from '@/types/csv';

// Minimal usage artifact builder replicating logic in artifactShims without quota logic.
function buildUsageArtifacts(processed: ProcessedData[]): UsageArtifacts {
  const modelTotals: Record<string, number> = {};
  const usersMap = new Map<string, { totalRequests: number; modelBreakdown: Record<string, number> }>();
  for (const row of processed) {
    modelTotals[row.model] = (modelTotals[row.model] || 0) + row.requestsUsed;
    const entry = usersMap.get(row.user) || { totalRequests: 0, modelBreakdown: {} };
    entry.totalRequests += row.requestsUsed;
    entry.modelBreakdown[row.model] = (entry.modelBreakdown[row.model] || 0) + row.requestsUsed;
    usersMap.set(row.user, entry);
  }
  const users = Array.from(usersMap.entries()).map(([user, v]) => {
    let topModel: string | undefined; let topModelValue = 0;
    for (const [m, qty] of Object.entries(v.modelBreakdown)) { if (qty > topModelValue) { topModelValue = qty; topModel = m; } }
    return { user, totalRequests: v.totalRequests, modelBreakdown: v.modelBreakdown, topModel, topModelValue };
  });
  return { users, modelTotals, userCount: users.length, modelCount: Object.keys(modelTotals).length };
}

describe('artifact analyzePowerUsersFromArtifacts', () => {
  it('identifies same power user as legacy path', () => {
    const processed = processCSVData(powerUserCSVData);
    const usage = buildUsageArtifacts(processed);
    const result = analyzePowerUsersFromArtifacts(usage);
    expect(result.powerUsers).toHaveLength(1);
    const pu = result.powerUsers[0];
    expect(pu.user).toBe('PowerUser1');
    expect(pu.totalRequests).toBe(22);
    // Score breakdown sanity
    expect(typeof pu.totalScore).toBe('number');
    expect(pu.breakdown.specialFeaturesScore).toBeGreaterThanOrEqual(0);
  });

  it('filters below threshold (<20 requests)', () => {
    const rows: CSVData[] = [
      createMockCSVData({ username: 'SmallUser', quantity: '5.0' }),
      createMockCSVData({ username: 'SmallUser', quantity: '10.0' })
    ];
    const processed = processCSVData(rows);
    const usage = buildUsageArtifacts(processed);
    const result = analyzePowerUsersFromArtifacts(usage);
    expect(result.totalQualifiedUsers).toBe(0);
    expect(result.powerUsers).toEqual([]);
  });

  it('caps display count to 20', () => {
    const rows: CSVData[] = [];
    for (let i = 1; i <= 25; i++) {
      for (let j = 0; j < 20; j++) {
        rows.push(createMockCSVData({ username: `User${i}`, quantity: '1.0', date: `2025-06-${String(j+1).padStart(2,'0')}` }));
      }
    }
    const processed = processCSVData(rows);
    const usage = buildUsageArtifacts(processed);
    const result = analyzePowerUsersFromArtifacts(usage);
    expect(result.totalQualifiedUsers).toBe(25);
    expect(result.powerUsers.length).toBeLessThanOrEqual(20);
  });

  it('calculates special feature scores consistently', () => {
    const models = ['Code Review', 'Coding Agent', 'Spark'];
    const score = calculateSpecialFeaturesScore(models);
    expect(score).toBe(20);
    expect(score).toBe(MAX_SPECIAL_FEATURES_SCORE);
    expect(SPECIAL_FEATURES_CONFIG.length).toBeGreaterThan(0);
  });
});
