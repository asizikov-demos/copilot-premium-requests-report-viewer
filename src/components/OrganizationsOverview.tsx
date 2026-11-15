'use client';

import { useState } from 'react';

import { BillingGroupDetailsView } from '@/components/BillingGroupDetailsView';
import { BillingGroupRow, BillingGroupTable, createDetailsColumn, useBillingGroupRows } from '@/components/BillingGroupTable';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { useUsageBasedBillingScope } from '@/hooks/useUsageBasedBillingScope';

interface OrganizationRow extends BillingGroupRow {
  users: number;
}

export function OrganizationsOverview() {
  const { billingPagesArtifacts, billingArtifacts } = useAnalysisContext();
  const { scopedBillingArtifacts, quantityColumnLabel, costLabels } =
    useUsageBasedBillingScope(billingArtifacts);
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);

  const orgRows = useBillingGroupRows(billingPagesArtifacts.organizations, scopedBillingArtifacts?.orgTotals);

  const hasCosts = orgRows.some(r => r.gross > 0 || r.net > 0);

  if (selectedOrganization !== null) {
    return (
      <BillingGroupDetailsView
        groupName={selectedOrganization}
        groupLabel="organization"
        groupsLabel="organizations"
        detailIdPrefix="organization-daily-details"
        groupKind="organization"
        quantityColumnLabel={quantityColumnLabel}
        costLabels={costLabels}
        hasAicGross={false}
        showUsers
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
