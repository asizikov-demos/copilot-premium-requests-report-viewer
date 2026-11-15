import type { TokenArtifacts } from '@/utils/ingestion/types';

export interface CreditTotals {
  quantity?: number;
  rowCount: number;
  reportedRows: number;
}

export interface UserConsumption {
  tokens?: TokenArtifacts;
  credits: CreditTotals;
  creditsByModel: Map<string, CreditTotals>;
}
