'use client';

import { BillingGroupTable, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';
import { UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

export function CostCentersOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();
  const { isUsageBasedBilling, billingRows, scopedBillingArtifacts, quantityColumnLabel, costLabels } =
    useUsageBasedBillingScope(aggregateProcessedData, billingArtifacts);

  const costCenterRows = useBillingGroupRows({
    sourceRows: billingRows,
    getGroupName: (row) => row.costCenter || UNASSIGNED_BILLING_GROUP,
    getTotals: (name) => scopedBillingArtifacts?.costCenterTotals.get(name),
  });

  const hasCosts = costCenterRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = scopedBillingArtifacts?.hasAnyAicData === true;

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
