'use client';

import { BillingGroupTable, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

export function CostCentersOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();

  const costCenterRows = useBillingGroupRows({
    sourceRows: aggregateProcessedData,
    getGroupName: (row) => row.costCenter || UNASSIGNED_BILLING_GROUP,
    getTotals: (name) => billingArtifacts?.costCenterTotals.get(name),
  });

  const hasCosts = costCenterRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = billingArtifacts?.hasAnyAicData === true;

  return (
    <BillingGroupTable
      title="Cost Centers"
      singularLabel="cost center"
      nameColumnLabel="Cost Center"
      rows={costCenterRows}
      hasCosts={hasCosts}
      hasAicGross={hasAicGross}
      detailIdPrefix="cost-center-details"
    />
  );
}
