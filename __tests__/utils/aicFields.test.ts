import { hasAicFields } from '@/utils/aicFields';

describe('hasAicFields', () => {
  it('requires AI Credits gross to be present', () => {
    expect(hasAicFields([{ aicQuantity: 10 }])).toBe(false);
    expect(hasAicFields([{ aicGrossAmount: 0 }])).toBe(true);
  });
});
