import type { ProcessedData } from '@/types/csv';
import type { CreditTotals, UserConsumption } from '@/types/consumption';
import { getEffectiveAicQuantity } from '@/utils/aicFields';
import { buildTokenArtifactsFromProcessedData } from '@/utils/ingestion/analytics';

function emptyCredits(): CreditTotals {
  return { rowCount: 0, reportedRows: 0 };
}

function addCredits(target: CreditTotals, value: number | undefined): void {
  target.rowCount++;
  if (value === undefined) return;
  target.quantity = (target.quantity ?? 0) + value;
  target.reportedRows++;
}

function creditQuantity(row: ProcessedData): number | undefined {
  if (row.aicQuantity !== undefined || row.aicGrossAmount !== undefined) {
    return getEffectiveAicQuantity(row);
  }
  if (row.usageUnit === 'ai_credit') return row.billingQuantity;
  return undefined;
}

export function buildUserConsumption(
  rows: ProcessedData[],
  includeTokens = true
): UserConsumption {
  const credits = emptyCredits();
  const creditsByModel = new Map<string, CreditTotals>();

  for (const row of rows) {
    const quantity = creditQuantity(row);
    addCredits(credits, quantity);
    const model = creditsByModel.get(row.model) ?? emptyCredits();
    addCredits(model, quantity);
    creditsByModel.set(row.model, model);
  }

  return {
    tokens: includeTokens ? buildTokenArtifactsFromProcessedData(rows) : undefined,
    credits,
    creditsByModel,
  };
}
