import { PRICING } from '@/constants/pricing';

interface AicPoolUser {
  user: string;
  quotaValue?: number | 'unlimited';
  isNonCopilotUsage?: boolean;
}

export interface AicPoolEstimate {
  includedCredits: number;
  includedGrossAmount: number;
  additionalUsageGrossAmount: number;
}

export function getIncludedAicCreditsForQuota(quotaValue: number | 'unlimited' | undefined): number {
  if (quotaValue === PRICING.BUSINESS_QUOTA) {
    return PRICING.BUSINESS_AI_CREDITS_INCLUDED;
  }

  if (quotaValue === PRICING.ENTERPRISE_QUOTA) {
    return PRICING.ENTERPRISE_AI_CREDITS_INCLUDED;
  }

  return 0;
}

export function calculateIncludedAicCreditsForUsers(users: Iterable<AicPoolUser>): number {
  const quotaByUser = new Map<string, number | 'unlimited' | undefined>();

  for (const user of users) {
    if (user.isNonCopilotUsage || quotaByUser.has(user.user)) {
      continue;
    }

    quotaByUser.set(user.user, user.quotaValue);
  }

  return Array.from(quotaByUser.values()).reduce<number>(
    (total, quotaValue) => total + getIncludedAicCreditsForQuota(quotaValue),
    0
  );
}

export function calculateAicPoolEstimate(includedCredits: number, aicGrossAmount: number): AicPoolEstimate {
  const includedGrossAmount = includedCredits * PRICING.AI_CREDIT_USD_VALUE;

  return {
    includedCredits,
    includedGrossAmount,
    additionalUsageGrossAmount: Math.max(aicGrossAmount - includedGrossAmount, 0),
  };
}
