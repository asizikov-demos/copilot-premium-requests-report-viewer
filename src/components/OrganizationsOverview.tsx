'use client';

import type { ProcessedData } from '@/types/csv';
import { UNASSIGNED_BILLING_GROUP } from '@/utils/ingestion';

import { BillingGroupRow, BillingGroupTable } from './BillingGroupTable';
import { useBillingGroupRows } from './useBillingGroupRows';
import { useAnalysisContext } from '@/context/AnalysisContext';

interface OrganizationExtraState {
  userSet: Set<string>;
}

interface OrganizationExtraFields {
  users: number;
}

type OrganizationRow = BillingGroupRow & OrganizationExtraFields;

function getOrganizationName(row: ProcessedData): string {
  return row.organization || UNASSIGNED_BILLING_GROUP;
}

function createOrganizationExtraState(): OrganizationExtraState {
  return { userSet: new Set() };
}

function updateOrganizationExtraState(state: OrganizationExtraState, row: ProcessedData): void {
  if (!row.isNonCopilotUsage) {
    state.userSet.add(row.user);
  }
}

function getOrganizationExtraFields(state: OrganizationExtraState): OrganizationExtraFields {
  return { users: state.userSet.size };
}

export function OrganizationsOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();

  const orgRows = useBillingGroupRows({
    rows: aggregateProcessedData,
    totalsByGroup: billingArtifacts?.orgTotals,
    getGroupName: getOrganizationName,
    createExtraState: createOrganizationExtraState,
    updateExtraState: updateOrganizationExtraState,
    getExtraFields: getOrganizationExtraFields,
  });

  const hasCosts = orgRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = billingArtifacts?.hasAnyAicData === true;

  return (
    <BillingGroupTable<OrganizationRow>
      title="Organizations"
      countLabel="organization"
      primaryHeader="Organization"
      detailsIdPrefix="organization-details"
      rows={orgRows}
      hasCosts={hasCosts}
      hasAicGross={hasAicGross}
      extraColumns={[
        {
          header: 'Users',
          render: (row) => row.users.toLocaleString(),
        },
      ]}
    />
  );
}
