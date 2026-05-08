import type { ProcessedData } from '@/types/csv';
import { buildDateKeys, monthKeyToLabel } from '@/utils/dateKeys';

export function getMonthKey(row: ProcessedData): string {
  return row.monthKey || buildDateKeys(row.timestamp).monthKey;
}

// Get available months (UTC) present in dataset
export function getAvailableMonths(data: ProcessedData[]): { value: string; label: string }[] {
  const monthsSet = new Set<string>();
  for (const row of data) {
    monthsSet.add(getMonthKey(row));
  }
  return Array.from(monthsSet)
    .sort()
    .map(key => ({ value: key, label: monthKeyToLabel(key) }));
}

export function hasMultipleMonths(data: ProcessedData[]): boolean {
  return getAvailableMonths(data).length > 1;
}

export function filterBySelectedMonths(data: ProcessedData[], selectedMonths: string[]): ProcessedData[] {
  if (selectedMonths.length === 0) return data;
  const selSet = new Set(selectedMonths);
  return data.filter(row => {
    const key = getMonthKey(row);
    return selSet.has(key);
  });
}
