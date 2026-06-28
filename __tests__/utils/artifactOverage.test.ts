import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import {
  buildBillingArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  buildUsageArtifactsFromProcessedData,
  computeOverageSummaryFromArtifacts,
} from '@/utils/ingestion';

import { makeUsageArtifacts as makeUsage, makeQuotaArtifacts as makeQuota } from '../helpers/makeArtifacts';
import { makeProcessedData } from '../helpers/testUtils';

const ENTERPRISE_QUOTA_FIELDS = {
  quotaValue: PRICING.ENTERPRISE_QUOTA,
} satisfies Partial<ProcessedData>;

function buildArtifactOverage(rows: ProcessedData[]) {
  const usage = buildUsageArtifactsFromProcessedData(rows);
  const quota = buildQuotaArtifactsFromProcessedData(rows);
  const billing = buildBillingArtifactsFromProcessedData(rows);

  return computeOverageSummaryFromArtifacts(usage, quota, billing);
}

describe('computeOverageSummaryFromArtifacts', () => {
  it('returns zero overage when all users are under quota', () => {
    const usage = makeUsage([
      { user: 'test-user-one', totalRequests: 100 },
      { user: 'test-user-two', totalRequests: 250 },
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_QUOTA },
      { user: 'test-user-two', quota: PRICING.BUSINESS_QUOTA },
    ]);

    const result = computeOverageSummaryFromArtifacts(usage, quota);

    expect(result.totalOverageRequests).toBe(0);
    expect(result.totalOverageCost).toBe(0);
  });

  it('estimates overage from usage and quota artifacts when billed overage is absent', () => {
    const usage = makeUsage([
      { user: 'test-user-one', totalRequests: 400 },
      { user: 'test-user-two', totalRequests: 1200 },
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_QUOTA },
      { user: 'test-user-two', quota: PRICING.ENTERPRISE_QUOTA },
    ]);

    const result = computeOverageSummaryFromArtifacts(usage, quota);

    expect(result.totalOverageRequests).toBeCloseTo(300, 5);
    expect(result.totalOverageCost).toBeCloseTo(300 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('ignores unknown quota users for estimated overage', () => {
    const usage = makeUsage([
      { user: 'test-user-one', totalRequests: 5000 },
      { user: 'test-user-two', totalRequests: 50 },
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: 'unknown' },
      { user: 'test-user-two', quota: PRICING.BUSINESS_QUOTA },
    ]);

    const result = computeOverageSummaryFromArtifacts(usage, quota);

    expect(result.totalOverageRequests).toBe(0);
    expect(result.totalOverageCost).toBe(0);
  });

  it('handles mixed quotas and partial estimated overages', () => {
    const usage = makeUsage([
      { user: 'test-user-one', totalRequests: 305 },
      { user: 'test-user-two', totalRequests: 999 },
      { user: 'test-user-three', totalRequests: 1500 },
      { user: 'test-user-four', totalRequests: 310 },
    ]);
    const quota = makeQuota([
      { user: 'test-user-one', quota: PRICING.BUSINESS_QUOTA },
      { user: 'test-user-two', quota: PRICING.ENTERPRISE_QUOTA },
      { user: 'test-user-three', quota: PRICING.ENTERPRISE_QUOTA },
      { user: 'test-user-four', quota: PRICING.BUSINESS_QUOTA },
    ]);

    const result = computeOverageSummaryFromArtifacts(usage, quota);

    expect(result.totalOverageRequests).toBe(515);
    expect(result.totalOverageCost).toBeCloseTo(515 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('returns billed overage artifacts when billing overage data exists', () => {
    const result = buildArtifactOverage([
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-17T00:00:00Z'),
        requestsUsed: 999,
        exceedsQuota: false,
        netAmount: 0,
        grossAmount: 999 * PRICING.OVERAGE_RATE_PER_REQUEST,
        discountAmount: 999 * PRICING.OVERAGE_RATE_PER_REQUEST,
      }),
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-18T00:00:00Z'),
        requestsUsed: 94,
        exceedsQuota: true,
        netAmount: 94 * PRICING.OVERAGE_RATE_PER_REQUEST,
        grossAmount: 999,
        discountAmount: 998,
      }),
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-19T00:00:00Z'),
        requestsUsed: 10,
        exceedsQuota: true,
        grossAmount: 10 * PRICING.OVERAGE_RATE_PER_REQUEST,
        discountAmount: 2 * PRICING.OVERAGE_RATE_PER_REQUEST,
      }),
    ]);

    expect(result.totalOverageRequests).toBe(104);
    expect(result.totalOverageCost).toBeCloseTo(102 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('falls back to estimated artifacts when billed rows have no billing amounts', () => {
    const result = buildArtifactOverage([
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-17T00:00:00Z'),
        requestsUsed: 1000,
        exceedsQuota: false,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
      }),
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-18T00:00:00Z'),
        requestsUsed: 25,
        exceedsQuota: true,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
      }),
    ]);

    expect(result.totalOverageRequests).toBe(25);
    expect(result.totalOverageCost).toBeCloseTo(25 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('does not treat discount-only billed rows as usable billing overage data', () => {
    const result = buildArtifactOverage([
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-17T00:00:00Z'),
        requestsUsed: 1000,
        exceedsQuota: false,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
      }),
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-18T00:00:00Z'),
        requestsUsed: 25,
        exceedsQuota: true,
        discountAmount: 25 * PRICING.OVERAGE_RATE_PER_REQUEST,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
      }),
    ]);

    expect(result.totalOverageRequests).toBe(25);
    expect(result.totalOverageCost).toBeCloseTo(25 * PRICING.OVERAGE_RATE_PER_REQUEST, 5);
  });

  it('resolves mixed quota rows using the higher effective quota', () => {
    const result = buildArtifactOverage([
      makeProcessedData({
        timestamp: new Date('2025-10-17T00:00:00Z'),
        requestsUsed: 800,
        exceedsQuota: false,
        quotaValue: PRICING.BUSINESS_QUOTA,
      }),
      makeProcessedData({
        ...ENTERPRISE_QUOTA_FIELDS,
        timestamp: new Date('2025-10-18T00:00:00Z'),
        requestsUsed: 150,
        exceedsQuota: false,
        quotaValue: PRICING.ENTERPRISE_QUOTA,
      }),
    ]);

    expect(result.totalOverageRequests).toBe(0);
    expect(result.totalOverageCost).toBe(0);
  });

  it('has one canonical OverageSummary declaration in analytics and ingestion modules', () => {
    const roots = ['src/utils/analytics', 'src/utils/ingestion'];
    const declarations = roots.flatMap((root) => {
      const absoluteRoot = path.join(process.cwd(), root);
      const files = collectTypeScriptFiles(absoluteRoot);

      return files.flatMap((file) => {
        const content = readFileSync(file, 'utf8');
        const matches = content.matchAll(/export\s+(?:interface|type)\s+OverageSummary\b/g);
        return Array.from(matches, () => path.relative(process.cwd(), file).replaceAll(path.sep, '/'));
      });
    });

    expect(declarations).toEqual(['src/utils/ingestion/analytics.ts']);
  });
});

function collectTypeScriptFiles(root: string): string[] {
  const entries = readdirSync(root);

  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return collectTypeScriptFiles(fullPath);
    }

    return fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') ? [fullPath] : [];
  });
}
