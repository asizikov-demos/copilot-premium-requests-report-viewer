'use client';

import { useMemo } from 'react';

import { getBillingCostLabels, type BillingCostLabels } from '@/utils/billingLabels';
import type { BillingArtifacts } from '@/utils/ingestion';

interface UseUsageBasedBillingScopeResult {
  scopedBillingArtifacts: BillingArtifacts | undefined;
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
}

export function useUsageBasedBillingScope(
  billingArtifacts: BillingArtifacts | undefined
): UseUsageBasedBillingScopeResult {
  const scopedBillingArtifacts = billingArtifacts;
  const quantityColumnLabel = 'AI Credits';
  const costLabels = useMemo(
    () => getBillingCostLabels(),
    []
  );

  return {
    scopedBillingArtifacts,
    quantityColumnLabel,
    costLabels,
  };
}
