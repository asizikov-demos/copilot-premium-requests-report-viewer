'use client';

import { useAnalysisContext } from '@/context/AnalysisContext';
import type { ProcessedData } from '@/types/csv';
import { UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

import { BillingGroupTable } from './BillingGroupTable';
import { useBillingGroupRows } from './useBillingGroupRows';

function getCostCenterName(row: ProcessedData): string {
  return row.costCenter || UNASSIGNED_BILLING_GROUP;
}

export function CostCentersOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();

  const costCenterRows = useBillingGroupRows({
    rows: aggregateProcessedData,
    totalsByGroup: billingArtifacts?.costCenterTotals,
    getGroupName: getCostCenterName,
  });

  const hasCosts = costCenterRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = billingArtifacts?.hasAnyAicData === true;

  return (
    <BillingGroupTable
      title="Cost Centers"
      countLabel="cost center"
      primaryHeader="Cost Center"
      detailsIdPrefix="cost-center-details"
      rows={costCenterRows}
      hasCosts={hasCosts}
      hasAicGross={hasAicGross}
    />
  );
}
