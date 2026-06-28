import { PRICING } from '@/constants/pricing';
import { calculateOverageRequests } from '@/utils/userCalculations';

describe('calculateOverageRequests', () => {
  it('returns zero when requests are within quota', () => {
    expect(calculateOverageRequests(PRICING.BUSINESS_QUOTA - 50, PRICING.BUSINESS_QUOTA)).toBe(0);
  });

  it('returns requests above quota', () => {
    expect(calculateOverageRequests(PRICING.BUSINESS_QUOTA + 150, PRICING.BUSINESS_QUOTA)).toBe(150);
  });

  it('returns zero for unknown quota', () => {
    expect(calculateOverageRequests(PRICING.BUSINESS_QUOTA + 150, 'unknown')).toBe(0);
  });
});
