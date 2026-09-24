'use client';

import { useMemo, useState } from 'react';

import { BillingGroupDetailsView } from '@/components/BillingGroupDetailsView';
import { BillingGroupEntry, BillingGroupRow, BillingGroupTable, createDetailsColumn, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';
import { UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

interface OrganizationRow extends BillingGroupRow {
  users: number;
}

export function OrganizationsOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();
  const { billingRows, scopedBillingArtifacts, quantityColumnLabel, costLabels } =
    useUsageBasedBillingScope(aggregateProcessedData, billingArtifacts);
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);

  const orgRows = useBillingGroupRows<{ users: number }>({
    sourceRows: billingRows,
    getGroupName: (row) => row.organization || UNASSIGNED_BILLING_GROUP,
    getTotals: (name) => scopedBillingArtifacts?.orgTotals.get(name),
    updateEntry: (entry: BillingGroupEntry, row) => {
      if (!row.isUnattributedUsage) {
        entry.users ??= new Set<string>();
        entry.users.add(row.user);
      }
    },
    getExtraFields: (entry) => ({ users: entry.users?.size ?? 0 }),
  });

  const hasCosts = orgRows.some(r => r.gross > 0 || r.net > 0);

  const selectedOrganizationRows = useMemo(
    () => (selectedOrganization === null
      ? []
      : billingRows.filter((row) => (row.organization || UNASSIGNED_BILLING_GROUP) === selectedOrganization)),
    [billingRows, selectedOrganization]
  );

  if (selectedOrganization !== null) {
    return (
      <BillingGroupDetailsView
        groupName={selectedOrganization}
        groupLabel="organization"
        groupsLabel="organizations"
        detailIdPrefix="organization-daily-details"
        rows={selectedOrganizationRows}
        quantityColumnLabel={quantityColumnLabel}
        costLabels={costLabels}
        hasAicGross={false}
        onBack={() => setSelectedOrganization(null)}
      />
    );
  }

  return (
    <BillingGroupTable<OrganizationRow>
      title="Organizations"
      singularLabel="organization"
      nameColumnLabel="Organization"
      rows={orgRows}
      hasCosts={hasCosts}
      hasAicGross={false}
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
      endColumns={[createDetailsColumn<OrganizationRow>(setSelectedOrganization)]}
    />
  );
}
