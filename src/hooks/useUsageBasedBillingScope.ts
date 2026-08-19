'use client';

import { useMemo } from 'react';

import type { ProcessedData } from '@/types/csv';
import { getBillingCostLabels, type BillingCostLabels } from '@/utils/billingLabels';
import { buildBillingArtifactsFromProcessedData, type BillingArtifacts } from '@/utils/ingestion';
import { isAiCreditUsageRow, isUsageBasedBillingRow } from '@/utils/unitType';

interface UseUsageBasedBillingScopeResult {
  isUsageBasedBilling: boolean;
  billingRows: ProcessedData[];
  scopedBillingArtifacts: BillingArtifacts | undefined;
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
}

export function useUsageBasedBillingScope(
  aggregateProcessedData: ProcessedData[],
  billingArtifacts: BillingArtifacts | undefined
): UseUsageBasedBillingScopeResult {
  const isUsageBasedBilling = useMemo(
    () => aggregateProcessedData.some(isUsageBasedBillingRow),
    [aggregateProcessedData]
  );
  const billingRows = useMemo(
    () => isUsageBasedBilling
      ? aggregateProcessedData.filter(isAiCreditUsageRow)
      : aggregateProcessedData,
    [aggregateProcessedData, isUsageBasedBilling]
  );
  const scopedBillingArtifacts = useMemo(
    () => (isUsageBasedBilling
      ? buildBillingArtifactsFromProcessedData(billingRows)
      : billingArtifacts),
    [billingArtifacts, billingRows, isUsageBasedBilling]
  );
  const quantityColumnLabel = isUsageBasedBilling ? 'Total AI Credits' : 'Requests';
  const costLabels = useMemo(
    () => getBillingCostLabels(isUsageBasedBilling),
    [isUsageBasedBilling]
  );

  return {
    isUsageBasedBilling,
    billingRows,
    scopedBillingArtifacts,
    quantityColumnLabel,
    costLabels,
  };
}
