'use client';

import { useMemo } from 'react';

import { BillingGroupEntry, BillingGroupRow, BillingGroupTable, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { buildBillingArtifactsFromProcessedData, UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

interface OrganizationRow extends BillingGroupRow {
  users: number;
}

export function OrganizationsOverview() {
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

  const orgRows = useBillingGroupRows<{ users: number }>({
    sourceRows: billingRows,
    getGroupName: (row) => row.organization || UNASSIGNED_BILLING_GROUP,
    getTotals: (name) => scopedBillingArtifacts?.orgTotals.get(name),
    updateEntry: (entry: BillingGroupEntry, row) => {
      if (!row.isNonCopilotUsage) {
        entry.users ??= new Set<string>();
        entry.users.add(row.user);
      }
    },
    getExtraFields: (entry) => ({ users: entry.users?.size ?? 0 }),
  });

  const hasCosts = orgRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = scopedBillingArtifacts?.hasAnyAicData === true;
  const quantityColumnLabel = isUsageBasedBilling ? 'Total AI Credits' : 'Requests';
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
