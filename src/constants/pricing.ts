export const PRICING = {
  OVERAGE_RATE_PER_REQUEST: 0.04,
  AI_CREDIT_USD_VALUE: 0.01,
  BUSINESS_AI_CREDITS_INCLUDED: 3000,
  ENTERPRISE_AI_CREDITS_INCLUDED: 7000,
  AUTO_MODE_DISCOUNT_RATE: 0.1,
  BUSINESS_QUOTA: 300,
  ENTERPRISE_QUOTA: 1000,
  ENTERPRISE_UPGRADE_DELTA: 20,
} as const;

// Recognized premium-request quota tiers. Any other numeric quota (e.g. the
// 2147483647 sentinel emitted for non-billable events) is treated as unknown.
export const KNOWN_QUOTA_VALUES: readonly number[] = [
  PRICING.BUSINESS_QUOTA,
  PRICING.ENTERPRISE_QUOTA,
];

// Cost optimization thresholds
export const COST_OPTIMIZATION_THRESHOLDS = {
  MIN_OVERAGE_THRESHOLD: 100,
  APPROACHING_BREAKEVEN_THRESHOLD: 400,
  STRONG_CANDIDATE_THRESHOLD: 500,
} as const;
