import { buildUserHeaderSummary } from '../helpers/detailFixtures';

import { makeUsageRow } from '../helpers/testUtils';

describe('buildUserHeaderSummary', () => {
  it('derives included and additional consumption from billed discount and net amounts', () => {
    const rows = [
      makeUsageRow({ day: '2026-06-01T00:00:00Z'.slice(0, 10), quantity: 1500, grossAmount: 15, discountAmount: 15, netAmount: 0, organization: 'test-org-two', costCenter: 'test-cost-center-one' }),
      makeUsageRow({ day: '2026-06-02T00:00:00Z'.slice(0, 10), quantity: 600, grossAmount: 6, discountAmount: 4, netAmount: 2, organization: 'test-org-one' }),
      makeUsageRow({ day: '2026-06-02T00:00:00Z'.slice(0, 10), quantity: 0, model: 'Coding Agent model' }),
      makeUsageRow({ day: '2026-06-02T00:00:00Z'.slice(0, 10), quantity: 0, model: 'Claude Sonnet 5', sku: 'coding_agent_ai_credit' }),
    ];

    const summary = buildUserHeaderSummary(rows, 1900, true);

    expect(summary).toMatchObject({
      organizations: ['test-org-one', 'test-org-two'],
      costCenters: ['test-cost-center-one'],
      daysActive: 2,
      daysInPeriod: 30,
      totalConsumed: 2100,
      includedConsumed: 1900,
      additionalConsumed: 200,
      totalCost: 21,
      additionalCost: 2,
      cloudAgentUsed: true,
      codeReviewUsed: false,
    });

    expect(buildUserHeaderSummary([
      makeUsageRow({ model: 'Claude Sonnet 5', sku: 'coding_agent_ai_credit' }),
    ], 'unknown', true).cloudAgentUsed).toBe(true);
  });

  it('falls back to a per-month quota split without billing data and omits the period length across months', () => {
    const rows = [
      makeUsageRow({ day: '2026-05-31T00:00:00Z'.slice(0, 10), quantity: 2000 }),
      makeUsageRow({ day: '2026-06-01T00:00:00Z'.slice(0, 10), quantity: 100, model: 'Code Review model' }),
    ];

    const summary = buildUserHeaderSummary(rows, 1900, false);

    expect(summary.includedConsumed).toBe(2000);
    expect(summary.additionalConsumed).toBe(100);
    expect(summary.daysInPeriod).toBeNull();
    expect(summary.totalCost).toBeNull();
    expect(summary.codeReviewUsed).toBe(true);
  });

  it('leaves the credit split empty when the quota is unknown', () => {
    const summary = buildUserHeaderSummary([makeUsageRow({ quantity: 5 })], 'unknown', false);

    expect(summary.totalConsumed).toBe(5);
    expect(summary.includedConsumed).toBeNull();
    expect(summary.additionalConsumed).toBeNull();
  });
});
