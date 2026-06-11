import { getEffectiveAicQuantity, hasAicFields } from '@/utils/aicFields';

describe('hasAicFields', () => {
  it('requires AI Credits gross to be present', () => {
    expect(hasAicFields([{ aicQuantity: 10 }])).toBe(false);
    expect(hasAicFields([{ aicGrossAmount: 0 }])).toBe(true);
  });
});

describe('getEffectiveAicQuantity', () => {
  it('uses the larger value when gross amount implies more credits than quantity', () => {
    expect(getEffectiveAicQuantity({ aicQuantity: 5, aicGrossAmount: 0.5 })).toBe(50);
  });

  it('preserves quantity when it is larger than the value derived from gross amount', () => {
    expect(getEffectiveAicQuantity({ aicQuantity: 75, aicGrossAmount: 0.5 })).toBe(75);
  });

  it('falls back to gross amount or zero when quantity is absent', () => {
    expect(getEffectiveAicQuantity({ aicGrossAmount: 0.25 })).toBe(25);
    expect(getEffectiveAicQuantity({})).toBe(0);
  });
});
