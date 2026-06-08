'use client';

import { BillingGroupEntry, BillingGroupRow, BillingGroupTable, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

interface OrganizationRow extends BillingGroupRow {
  users: number;
}

export function OrganizationsOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();

  const orgRows = useBillingGroupRows<{ users: number }>({
    sourceRows: aggregateProcessedData,
    getGroupName: (row) => row.organization || UNASSIGNED_BILLING_GROUP,
    getTotals: (name) => billingArtifacts?.orgTotals.get(name),
    updateEntry: (entry: BillingGroupEntry, row) => {
      if (!row.isNonCopilotUsage) {
        entry.users ??= new Set<string>();
        entry.users.add(row.user);
      }
    },
    getExtraFields: (entry) => ({ users: entry.users?.size ?? 0 }),
  });

  const hasCosts = orgRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = billingArtifacts?.hasAnyAicData === true;
  const hasAiCreditUsage = aggregateProcessedData.some((row) => row.usageUnit === 'ai_credit');
  const hasRequestUsage = aggregateProcessedData.some((row) => row.usageUnit === 'request' && row.requestsUsed > 0);
  const isUsageBasedBilling = hasAiCreditUsage && !hasRequestUsage;
  const quantityColumnLabel = isUsageBasedBilling ? 'AI Credits' : 'Requests';
  const costLabels = getBillingCostLabels(isUsageBasedBilling);

  return (
    <BillingGroupTable<OrganizationRow>
      title="Organizations"
      singularLabel="organization"
      nameColumnLabel="Organization"
      rows={orgRows}
      hasCosts={hasCosts}
      hasAicGross={hasAicGross && !isUsageBasedBilling}
      detailIdPrefix="organization-details"
      quantityColumnLabel={quantityColumnLabel}
      grossColumnLabel={costLabels.gross}
      discountColumnLabel={costLabels.discount}
      netColumnLabel={costLabels.net}
      extraColumns={[
        {
          key: 'users',
          header: 'Users',
          render: (row) => row.users.toLocaleString(),
        },
      ]}
    />
  );
}
