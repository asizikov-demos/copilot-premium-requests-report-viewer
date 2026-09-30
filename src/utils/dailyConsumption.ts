import type { ProcessedData } from '@/types/csv';

export interface DailyConsumptionDatum {
  date: string;
  included: number;
  additional: number;
}

export function aggregateDailyConsumption(rows: ProcessedData[]): DailyConsumptionDatum[] {
  const byDay = new Map<string, DailyConsumptionDatum>();

  for (const row of rows) {
    if (row.discountAmount === undefined && row.netAmount === undefined) {
      continue;
    }

    const day = byDay.get(row.dateKey) ?? {
      date: row.dateKey,
      included: 0,
      additional: 0,
    };
    day.included += row.discountAmount ?? 0;
    day.additional += row.netAmount ?? 0;
    byDay.set(row.dateKey, day);
  }

  return [...byDay.values()].sort((left, right) => left.date.localeCompare(right.date));
}
