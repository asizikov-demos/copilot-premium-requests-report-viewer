import { PRICING } from '@/constants/pricing';

interface AicPoolUser {
  user: string;
  quotaValue?: number | 'unknown';
  isNonCopilotUsage?: boolean;
}

export interface AicPoolEstimate {
  includedCredits: number;
  includedGrossAmount: number;
  additionalUsageGrossAmount: number;
}

export function getIncludedAicCreditsForQuota(quotaValue: number | 'unknown' | undefined): number {
  if (quotaValue === PRICING.BUSINESS_QUOTA) {
    return PRICING.BUSINESS_AI_CREDITS_INCLUDED;
  }

  if (quotaValue === PRICING.ENTERPRISE_QUOTA) {
    return PRICING.ENTERPRISE_AI_CREDITS_INCLUDED;
  }

  return 0;
}

export function calculateIncludedAicCreditsForUsers(users: Iterable<AicPoolUser>): number {
  const quotaByUser = new Map<string, number | 'unknown' | undefined>();

  for (const user of users) {
    if (user.isNonCopilotUsage) {
      continue;
    }

    const existingQuota = quotaByUser.get(user.user);
    const currentQuota = user.quotaValue;
    if (
      !quotaByUser.has(user.user)
      || (existingQuota === 'unknown' && typeof currentQuota === 'number')
      || (typeof currentQuota === 'number' && typeof existingQuota === 'number' && currentQuota > existingQuota)
    ) {
      quotaByUser.set(user.user, currentQuota);
    }
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
