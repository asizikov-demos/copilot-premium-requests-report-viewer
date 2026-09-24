import { PRICING } from '@/constants/pricing';
import { calculateExcessCredits } from '@/utils/userCalculations';

describe('calculateExcessCredits', () => {
  it('returns zero when AI credits are within quota', () => {
    expect(calculateExcessCredits(PRICING.BUSINESS_AI_CREDIT_QUOTA - 50, PRICING.BUSINESS_AI_CREDIT_QUOTA)).toBe(0);
  });

  it('returns AI credits above quota', () => {
    expect(calculateExcessCredits(PRICING.BUSINESS_AI_CREDIT_QUOTA + 150, PRICING.BUSINESS_AI_CREDIT_QUOTA)).toBe(150);
  });

  it('returns zero for unknown quota', () => {
    expect(calculateExcessCredits(PRICING.BUSINESS_AI_CREDIT_QUOTA + 150, 'unknown')).toBe(0);
  });
});
