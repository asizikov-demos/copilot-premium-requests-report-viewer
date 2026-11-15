'use client';

import { useState } from 'react';

import { BillingGroupDetailsView } from '@/components/BillingGroupDetailsView';
import { BillingGroupTable, createDetailsColumn, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';

export function CostCentersOverview() {
  const { billingPagesArtifacts, billingArtifacts } = useAnalysisContext();
  const { scopedBillingArtifacts, quantityColumnLabel, costLabels } =
    useUsageBasedBillingScope(billingArtifacts);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string | null>(null);

  const costCenterRows = useBillingGroupRows(billingPagesArtifacts.costCenters, scopedBillingArtifacts?.costCenterTotals);

  const hasCosts = costCenterRows.some(r => r.gross > 0 || r.net > 0);

  if (selectedCostCenter !== null) {
    return (
      <BillingGroupDetailsView
        groupName={selectedCostCenter}
        groupLabel="cost center"
        groupsLabel="cost centers"
        detailIdPrefix="cost-center-daily-details"
        groupKind="costCenter"
        quantityColumnLabel={quantityColumnLabel}
        costLabels={costLabels}
        hasAicGross={false}
        showUsers
        onBack={() => setSelectedCostCenter(null)}
      />
    );
  }

  return (
    <BillingGroupTable
      title="Cost Centers"
      singularLabel="cost center"
      nameColumnLabel="Cost Center"
      rows={costCenterRows}
      hasCosts={hasCosts}
      hasAicGross={false}
      detailIdPrefix="cost-center-details"
      quantityColumnLabel={quantityColumnLabel}
      grossColumnLabel={costLabels.gross}
      discountColumnLabel={costLabels.discount}
      netColumnLabel={costLabels.net}
      endColumns={[createDetailsColumn(setSelectedCostCenter)]}
    />
  );
}
