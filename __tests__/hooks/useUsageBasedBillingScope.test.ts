import { renderHook } from '@testing-library/react';

import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';
import { buildBillingArtifactsFromProcessedData } from '@/utils/ingestion';

import { makeProcessedData } from '../helpers/testUtils';

describe('useUsageBasedBillingScope', () => {
  it('keeps request-based billing rows and artifacts unchanged', () => {
    const rows = [
      makeProcessedData({
        user: 'test-user-one',
        model: 'test-model-one',
        requestsUsed: 3,
        usageUnit: 'request',
        billingQuantity: 3,
        grossAmount: 0.12,
        netAmount: 0.12,
      }),
    ];
    const billingArtifacts = buildBillingArtifactsFromProcessedData(rows);

    const { result } = renderHook(() => useUsageBasedBillingScope(rows, billingArtifacts));

    expect(result.current.isUsageBasedBilling).toBe(false);
    expect(result.current.billingRows).toBe(rows);
    expect(result.current.scopedBillingArtifacts).toBe(billingArtifacts);
    expect(result.current.quantityColumnLabel).toBe('Requests');
    expect(result.current.costLabels).toMatchObject({
      gross: 'Gross',
      discount: 'Discount',
      net: 'Net',
    });
  });

  it('filters billing rows and rebuilds artifacts for usage-based AI credits', () => {
    const requestRow = makeProcessedData({
      user: 'test-user-one',
      model: 'test-request-model',
      requestsUsed: 5,
      usageUnit: 'request',
      billingQuantity: 5,
      grossAmount: 0.2,
      netAmount: 0.2,
      organization: 'test-org-one',
      costCenter: 'test-cost-center-one',
    });
    const aiCreditRow = makeProcessedData({
      user: 'test-user-two',
      model: 'test-ai-credit-model',
      requestsUsed: 2,
      usageUnit: 'ai_credit',
      billingQuantity: 10,
      grossAmount: 0.4,
      discountAmount: 0.1,
      netAmount: 0.3,
      aicQuantity: 10,
      aicGrossAmount: 0.4,
      organization: 'test-org-two',
      costCenter: 'test-cost-center-two',
    });
    const rows = [requestRow, aiCreditRow];
    const billingArtifacts = buildBillingArtifactsFromProcessedData(rows);

    const { result } = renderHook(() => useUsageBasedBillingScope(rows, billingArtifacts));

    expect(result.current.isUsageBasedBilling).toBe(true);
    expect(result.current.billingRows).toEqual([aiCreditRow]);
    expect(result.current.scopedBillingArtifacts).not.toBe(billingArtifacts);
    expect(result.current.scopedBillingArtifacts?.totals).toMatchObject({
      gross: 0.4,
      discount: 0.1,
      net: 0.3,
      aicQuantity: 10,
      aicGrossAmount: 0.4,
    });
    expect(result.current.scopedBillingArtifacts?.billingByModel.has('test-request-model')).toBe(false);
    expect(result.current.scopedBillingArtifacts?.billingByModel.get('test-ai-credit-model')?.aicQuantity).toBe(10);
    expect(result.current.quantityColumnLabel).toBe('Total AI Credits');
    expect(result.current.costLabels).toMatchObject({
      gross: 'Gross Amount',
      discount: 'Included Credits',
      net: 'Additional usage',
    });
  });
});
