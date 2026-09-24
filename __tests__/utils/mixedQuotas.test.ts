import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';

import { analyzeData, processCSVData } from '../helpers/processCSVData';

const row = (
  username: string,
  quantity: number,
  quota: number | 'Unknown',
  date = '2026-06-01'
): CSVData => ({
  date,
  username,
  product: 'copilot',
  sku: 'copilot_ai_credit',
  unit_type: 'ai-credits',
  model: 'test-model',
  quantity: String(quantity),
  total_monthly_quota: String(quota),
});

describe('AI-credit quota tiers', () => {
  const data = [
    row('test-user-one', 100, PRICING.BUSINESS_AI_CREDIT_QUOTA),
    row('test-user-two', 10.5, PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
    row('test-user-three', 15.25, 'Unknown'),
    row('test-user-one', PRICING.BUSINESS_AI_CREDIT_QUOTA, PRICING.BUSINESS_AI_CREDIT_QUOTA, '2026-06-10'),
  ];

  it('parses the recognized quotas and treats other quotas as unknown', () => {
    expect(processCSVData(data).map(r => r.quotaValue)).toEqual([
      PRICING.BUSINESS_AI_CREDIT_QUOTA,
      PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
      'unknown',
      PRICING.BUSINESS_AI_CREDIT_QUOTA,
    ]);
    expect(processCSVData([row('test-user-four', 5, 300)])[0].quotaValue).toBe('unknown');
    expect(processCSVData([row('test-user-four', 5, 1000)])[0].quotaValue).toBe('unknown');
  });

  it('classifies mixed tiers and counts users with credits above their individual quota', () => {
    const analysis = analyzeData(processCSVData(data));
    expect(analysis.quotaBreakdown).toMatchObject({
      business: ['test-user-one'],
      enterprise: ['test-user-two'],
      unknown: ['test-user-three'],
      mixed: true,
      suggestedPlan: null,
    });
    expect(analysis.usersExceedingQuota).toBe(1);
  });

  it('suggests a plan for homogeneous business and enterprise data', () => {
    const business = analyzeData(processCSVData([
      row('test-user-one', 5, PRICING.BUSINESS_AI_CREDIT_QUOTA),
      row('test-user-two', 10, PRICING.BUSINESS_AI_CREDIT_QUOTA),
    ]));
    expect(business.quotaBreakdown).toMatchObject({
      mixed: false,
      suggestedPlan: 'business',
      business: ['test-user-one', 'test-user-two'],
    });
    const enterprise = analyzeData(processCSVData([
      row('test-user-one', 5, PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
      row('test-user-two', 10, PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
    ]));
    expect(enterprise.quotaBreakdown).toMatchObject({
      mixed: false,
      suggestedPlan: 'enterprise',
      enterprise: ['test-user-one', 'test-user-two'],
    });
  });

  it('rejects unsupported request rows rather than letting them affect a plan', () => {
    const processed = processCSVData([
      row('test-user-one', 5, PRICING.BUSINESS_AI_CREDIT_QUOTA),
      { ...row('test-user-two', 4000, PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
        sku: 'copilot_premium_request', unit_type: 'requests' },
    ]);
    expect(processed).toHaveLength(1);
    expect(analyzeData(processed).quotaBreakdown.suggestedPlan).toBe('business');
  });

  it('ignores non-billable sentinels and uses the highest known quota for a user', () => {
    const processed = processCSVData([
      row('test-user-one', 5, PRICING.ENTERPRISE_AI_CREDIT_QUOTA),
      row('test-user-one', 2, 2147483647, '2026-06-02'),
    ]);
    expect(processed[1].quotaValue).toBe('unknown');
    expect(processed[1].totalQuota).toBe('Unknown');
    expect(analyzeData(processed).quotaBreakdown.enterprise).toEqual(['test-user-one']);
  });
});
