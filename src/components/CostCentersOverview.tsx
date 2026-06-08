'use client';

import { BillingGroupTable, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { getBillingCostLabels } from '@/utils/billingLabels';
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
  const hasAiCreditUsage = aggregateProcessedData.some((row) => row.usageUnit === 'ai_credit');
  const hasRequestUsage = aggregateProcessedData.some((row) => row.usageUnit === 'request' && row.requestsUsed > 0);
  const isUsageBasedBilling = hasAiCreditUsage && !hasRequestUsage;
  const quantityColumnLabel = isUsageBasedBilling ? 'AI Credits' : 'Requests';
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
