import { renderHook } from '@testing-library/react';

import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';
import { BillingAggregator } from '@/utils/ingestion';

import { aggregateRows } from '../helpers/aggregateRows';
import { makeNormalizedRow } from '../helpers/makeNormalizedRow';

describe('useUsageBasedBillingScope', () => {
  it('uses the selected billing artifacts without reconstructing rows', () => {
    const billing = aggregateRows(new BillingAggregator(), [
      makeNormalizedRow({ quantity: 2.5, netAmount: 0.025 }),
    ]);
    const { result } = renderHook(() => useUsageBasedBillingScope(billing));
    expect(result.current.scopedBillingArtifacts).toBe(billing);
    expect(result.current.quantityColumnLabel).toBe('AI Credits');
    expect(result.current.scopedBillingArtifacts?.totals.net).toBe(0.025);
  });

  it('preserves absent optional billing artifacts', () => {
    const { result } = renderHook(() => useUsageBasedBillingScope(undefined));
    expect(result.current.scopedBillingArtifacts).toBeUndefined();
  });
});
