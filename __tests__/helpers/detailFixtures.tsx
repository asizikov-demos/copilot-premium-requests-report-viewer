import { useContext } from 'react';

import { BillingGroupDetailsContent, type BillingGroupDetailsViewProps } from '@/components/BillingGroupDetailsView';
import { UserConsumptionMetrics as ConsumptionMetrics } from '@/components/UserConsumptionMetrics';
import { UserDetailsContent, type UserDetailsViewProps } from '@/components/UserDetailsView';
import { AnalysisContext } from '@/context/AnalysisContext';
import type { ProcessedData } from '@/types/csv';
import { buildNormalizedRowFromProcessedData } from '@/utils/ingestion/analytics';
import { DetailAggregator } from '@/utils/ingestion/DetailAggregator';
import { TokenAccumulator } from '@/utils/ingestion/TokenAccumulator';
import { UserHeaderAccumulator, summarizeUserHeader } from '@/utils/userHeaderSummary';

import { buildUserConsumption } from './legacyUserConsumption';

export function buildUserHeaderSummary(rows: ProcessedData[], quota: number | 'unknown', hasBillingData: boolean) {
  const accumulator = new UserHeaderAccumulator();
  for (const row of rows) accumulator.add(row);
  return summarizeUserHeader(accumulator.finalize(), quota, hasBillingData);
}

export function detailFixture(rows: ProcessedData[]) {
  const details = new DetailAggregator();
  const tokens = new TokenAccumulator();
  for (const row of rows) {
    const normalized = buildNormalizedRowFromProcessedData(row);
    details.onRow(normalized);
    tokens.addRow(normalized);
  }
  return { details: details.finalize(), tokens: tokens.finalize() };
}

export function UserDetailsView({ processedData, ...props }: UserDetailsViewProps & { processedData: ProcessedData[] }) {
  const context = useContext(AnalysisContext);
  const months = context?.dailyBucketsArtifacts?.months ?? processedData.map(row => row.monthKey);
  return <UserDetailsContent {...props} months={months}
    data={detailFixture(processedData.filter(row => row.user === props.user))} />;
}

export function BillingGroupDetailsView({ rows, periodRows = rows, ...props }:
  Omit<BillingGroupDetailsViewProps, 'groupKind'> & { rows: ProcessedData[]; periodRows?: ProcessedData[] }) {
  return <BillingGroupDetailsContent {...props} groupKind={props.groupLabel === 'organization' ? 'organization' : 'costCenter'}
    data={detailFixture(rows)} months={periodRows.map(row => row.monthKey)} />;
}

export function UserConsumptionMetrics({ rows, periodRows = rows, tokensAvailable = true }: {
  rows: ProcessedData[];
  periodRows?: ProcessedData[];
  tokensAvailable?: boolean;
}) {
  return <ConsumptionMetrics metrics={buildUserConsumption(rows, tokensAvailable)}
    months={periodRows.map(row => row.monthKey)} />;
}
