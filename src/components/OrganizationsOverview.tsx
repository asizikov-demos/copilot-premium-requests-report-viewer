'use client';

import { BillingGroupEntry, BillingGroupRow, BillingGroupTable, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
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

  return (
    <BillingGroupTable<OrganizationRow>
      title="Organizations"
      singularLabel="organization"
      nameColumnLabel="Organization"
      rows={orgRows}
      hasCosts={hasCosts}
      hasAicGross={hasAicGross}
      detailIdPrefix="organization-details"
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
