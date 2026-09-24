export const PRICING = {
  AI_CREDIT_USD_VALUE: 0.01,
  BUSINESS_AI_CREDIT_QUOTA: 1900,
  ENTERPRISE_AI_CREDIT_QUOTA: 3900,
  AUTO_MODE_DISCOUNT_RATE: 0.1,
  ENTERPRISE_UPGRADE_DELTA: 20,
} as const;

export const BUSINESS_QUOTA_VALUES: readonly number[] = [
  PRICING.BUSINESS_AI_CREDIT_QUOTA,
];

export const ENTERPRISE_QUOTA_VALUES: readonly number[] = [
  PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
];

// Non-billable sentinels and unrecognized quotas are unknown.
export const KNOWN_QUOTA_VALUES: readonly number[] = [
  ...BUSINESS_QUOTA_VALUES,
  ...ENTERPRISE_QUOTA_VALUES,
];
