import { renderHook } from '@testing-library/react';

import { PRICING } from '@/constants/pricing';
import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';
import { buildBillingArtifactsFromProcessedData } from '@/utils/ingestion';

import { makeProcessedData } from '../helpers/testUtils';

describe('useUsageBasedBillingScope', () => {
  const rows = [
    makeProcessedData({
      user: 'test-user-one',
      creditsUsed: 2.5,
      billingQuantity: 2.5,
      quotaValue: PRICING.BUSINESS_AI_CREDIT_QUOTA,
      netAmount: 0.025,
    }),
    makeProcessedData({
      user: 'test-user-two',
      creditsUsed: 4,
      billingQuantity: 4,
      quotaValue: PRICING.ENTERPRISE_AI_CREDIT_QUOTA,
      netAmount: 0,
    }),
  ];

  it('keeps all supported AI-credit rows and uses supplied billing artifacts', () => {
    const billing = buildBillingArtifactsFromProcessedData(rows);
    const { result } = renderHook(() => useUsageBasedBillingScope(rows, billing));
    expect(result.current.billingRows).toBe(rows);
    expect(result.current.scopedBillingArtifacts).toBe(billing);
    expect(result.current.quantityColumnLabel).toBe('AI Credits');
    expect(result.current.scopedBillingArtifacts?.totals.net).toBe(0.025);
  });

  it('rebuilds billing artifacts if the streaming artifact is absent', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useUsageBasedBillingScope(data, undefined),
      { initialProps: { data: rows } }
    );
    expect(result.current.scopedBillingArtifacts?.userMap.get('test-user-one')?.quantity).toBe(2.5);
    const nextRows = rows.filter(row => row.user === 'test-user-two');
    rerender({ data: nextRows });
    expect(result.current.billingRows).toBe(nextRows);
    expect(result.current.scopedBillingArtifacts?.userMap.has('test-user-one')).toBe(false);
  });

  it('preserves rows with token counts and optional billing fields', () => {
    const tokenRow = makeProcessedData({
      user: 'test-user-one',
      creditsUsed: 1,
      inputTokens: 100,
      outputTokens: 20,
      netAmount: undefined,
    });
    const { result } = renderHook(() => useUsageBasedBillingScope([tokenRow], undefined));
    expect(result.current.billingRows[0]).toBe(tokenRow);
    expect(result.current.scopedBillingArtifacts?.hasAnyBillingData).toBe(false);
  });
});
