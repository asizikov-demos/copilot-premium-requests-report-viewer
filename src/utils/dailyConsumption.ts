import type { ProcessedData } from '@/types/csv';

import { enumerateDatesInclusive } from './dateKeys';

export interface DailyConsumptionDatum {
  date: string;
  included: number;
  additional: number;
}

export function aggregateDailyConsumption(
  rows: ProcessedData[],
  periodRows: ProcessedData[] = rows
): DailyConsumptionDatum[] {
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

  if (byDay.size === 0 || periodRows.length === 0) {
    return [];
  }

  let earliestMonth = periodRows[0].monthKey;
  let latestMonth = earliestMonth;
  for (const row of periodRows) {
    if (row.monthKey < earliestMonth) {
      earliestMonth = row.monthKey;
    }
    if (row.monthKey > latestMonth) {
      latestMonth = row.monthKey;
    }
  }

  const start = `${earliestMonth}-01`;
  const end = new Date(`${latestMonth}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);

  return enumerateDatesInclusive(start, end.toISOString().slice(0, 10)).map(date =>
    byDay.get(date) ?? { date, included: 0, additional: 0 }
  );
}
