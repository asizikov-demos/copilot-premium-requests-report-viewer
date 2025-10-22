import { ProcessedData } from '@/types/csv';

// Static UTC month names map to avoid locale/date allocations during month label generation.
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Helper function to check if CSV data contains June 2025 data
export function containsJune2025Data(data: ProcessedData[]): boolean {
  return data.some(row => row.timestamp.toISOString().startsWith('2025-06-'));
}

// Filter out early June 2025 data (1st-18th June 2025) while preserving UTC semantics
export function filterEarlyJune2025(data: ProcessedData[]): ProcessedData[] {
  return data.filter(row => {
    const iso = row.timestamp.toISOString();
    if (!iso.startsWith('2025-06-')) return true;
    const day = parseInt(iso.substring(8, 10), 10);
    return day > 18; // Only keep 19th onwards
  });
}

// Get available months (UTC) present in dataset
export function getAvailableMonths(data: ProcessedData[]): { value: string; label: string }[] {
  const monthsSet = new Set<string>();
  for (const row of data) {
    if (row.monthKey) {
      monthsSet.add(row.monthKey);
    } else {
      const d = row.timestamp;
      const computed = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(computed);
    }
  }
  return Array.from(monthsSet)
    .sort()
    .map(key => {
      const [yearStr, monthStr] = key.split('-');
      const year = yearStr; // already YYYY
      const monthIndex = parseInt(monthStr, 10) - 1; // 0-based
      const label = `${MONTH_NAMES[monthIndex]} ${year}`;
      return { value: key, label };
    });
}

export function hasMultipleMonths(data: ProcessedData[]): boolean {
  return getAvailableMonths(data).length > 1;
}

export function filterBySelectedMonths(data: ProcessedData[], selectedMonths: string[]): ProcessedData[] {
  if (selectedMonths.length === 0) return data;
  const selSet = new Set(selectedMonths);
  return data.filter(row => {
    const key = row.monthKey || `${row.timestamp.getUTCFullYear()}-${String(row.timestamp.getUTCMonth() + 1).padStart(2, '0')}`;
    return selSet.has(key);
  });
}
