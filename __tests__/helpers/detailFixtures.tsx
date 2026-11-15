import { useContext } from 'react';

import { BillingGroupDetailsContent, type BillingGroupDetailsViewProps } from '@/components/BillingGroupDetailsView';
import { UserConsumptionMetrics as ConsumptionMetrics } from '@/components/UserConsumptionMetrics';
import { UserDetailsContent, type UserDetailsViewProps } from '@/components/UserDetailsView';
import { AnalysisContext } from '@/context/AnalysisContext';
import type { NormalizedRow } from '@/utils/ingestion';
import { DetailAggregator, selectDetailArtifacts } from '@/utils/ingestion/DetailAggregator';
import { TokenAccumulator } from '@/utils/ingestion/TokenAccumulator';
import { UserHeaderAccumulator, summarizeUserHeader } from '@/utils/userHeaderSummary';

import { buildUserConsumption } from './consumptionReference';

export function buildUserHeaderSummary(rows: NormalizedRow[], quota: number | 'unknown', hasBillingData: boolean) {
  const accumulator = new UserHeaderAccumulator();
  for (const row of rows) accumulator.add(row);
  return summarizeUserHeader(accumulator.finalize(), quota, hasBillingData);
}

export function detailFixture(rows: NormalizedRow[]) {
  const details = new DetailAggregator();
  const tokens = new TokenAccumulator();
  for (const row of rows) {
    details.onRow(row);
    tokens.addRow(row);
  }
  return { details: selectDetailArtifacts(details.finalize()), tokens: tokens.finalize() };
}

export function UserDetailsView({ rows, ...props }: UserDetailsViewProps & { rows: NormalizedRow[] }) {
  const context = useContext(AnalysisContext);
  const reportMonth = context?.reportMonth ?? rows[0]?.day.slice(0, 7);
  return <UserDetailsContent {...props} reportMonth={reportMonth}
    data={detailFixture(rows.filter(row => row.user === props.user))} />;
}

export function BillingGroupDetailsView({ rows, periodRows = rows, ...props }:
  Omit<BillingGroupDetailsViewProps, 'groupKind'> & { rows: NormalizedRow[]; periodRows?: NormalizedRow[] }) {
  return <BillingGroupDetailsContent {...props} groupKind={props.groupLabel === 'organization' ? 'organization' : 'costCenter'}
    data={detailFixture(rows)} reportMonth={periodRows[0]?.day.slice(0, 7)} />;
}

export function UserConsumptionMetrics({ rows, periodRows = rows, tokensAvailable = true }: {
  rows: NormalizedRow[];
  periodRows?: NormalizedRow[];
  tokensAvailable?: boolean;
}) {
  return <ConsumptionMetrics metrics={buildUserConsumption(rows, tokensAvailable)}
    reportMonth={periodRows[0]?.day.slice(0, 7)} />;
}
