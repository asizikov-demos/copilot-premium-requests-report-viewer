'use client';

import { useMemo } from 'react';

import type { ProcessedData } from '@/types/csv';
import { getBillingCostLabels, type BillingCostLabels } from '@/utils/billingLabels';
import { buildBillingArtifactsFromProcessedData, type BillingArtifacts } from '@/utils/ingestion';

interface UseUsageBasedBillingScopeResult {
  billingRows: ProcessedData[];
  scopedBillingArtifacts: BillingArtifacts | undefined;
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
}

export function useUsageBasedBillingScope(
  aggregateProcessedData: ProcessedData[],
  billingArtifacts: BillingArtifacts | undefined
): UseUsageBasedBillingScopeResult {
  const billingRows = aggregateProcessedData;
  const scopedBillingArtifacts = useMemo(
    () => billingArtifacts ?? buildBillingArtifactsFromProcessedData(billingRows),
    [billingArtifacts, billingRows]
  );
  const quantityColumnLabel = 'AI Credits';
  const costLabels = useMemo(
    () => getBillingCostLabels(),
    []
  );

  return {
    billingRows,
    scopedBillingArtifacts,
    quantityColumnLabel,
    costLabels,
  };
}
