'use client';

import { useMemo } from 'react';

import { BillingGroupTable, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { buildBillingArtifactsFromProcessedData, UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

export function CostCentersOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();
  const isUsageBasedBilling = aggregateProcessedData.some((row) => row.usageUnit === 'ai_credit');
  const billingRows = useMemo(
    () => isUsageBasedBilling
      ? aggregateProcessedData.filter((row) => row.usageUnit === 'ai_credit')
      : aggregateProcessedData,
    [aggregateProcessedData, isUsageBasedBilling]
  );
  const scopedBillingArtifacts = useMemo(
    () => billingArtifacts && isUsageBasedBilling
      ? buildBillingArtifactsFromProcessedData(billingRows)
      : billingArtifacts,
    [billingArtifacts, billingRows, isUsageBasedBilling]
  );

  const costCenterRows = useBillingGroupRows({
    sourceRows: billingRows,
    getGroupName: (row) => row.costCenter || UNASSIGNED_BILLING_GROUP,
    getTotals: (name) => scopedBillingArtifacts?.costCenterTotals.get(name),
  });

  const hasCosts = costCenterRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = scopedBillingArtifacts?.hasAnyAicData === true;
  const quantityColumnLabel = isUsageBasedBilling ? 'Total AI Credits' : 'Requests';
  const costLabels = getBillingCostLabels(isUsageBasedBilling);

  return (
    <BillingGroupTable
      title="Cost Centers"
      singularLabel="cost center"
      nameColumnLabel="Cost Center"
      rows={costCenterRows}
      hasCosts={hasCosts}
      hasAicGross={hasAicGross && !isUsageBasedBilling}
      detailIdPrefix="cost-center-details"
      quantityColumnLabel={quantityColumnLabel}
      grossColumnLabel={costLabels.gross}
      discountColumnLabel={costLabels.discount}
      netColumnLabel={costLabels.net}
    />
  );
}
