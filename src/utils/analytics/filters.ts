import { ProcessedData } from '@/types/csv';

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
  data.forEach(row => {
    const d = row.timestamp;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(key);
  });
  return Array.from(monthsSet).sort().map(key => {
    const [year, month] = key.split('-');
    const date = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1));
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { value: key, label: monthName };
  });
}

export function hasMultipleMonths(data: ProcessedData[]): boolean {
  return getAvailableMonths(data).length > 1;
}

export function filterBySelectedMonths(data: ProcessedData[], selectedMonths: string[]): ProcessedData[] {
  if (selectedMonths.length === 0) return data;
  return data.filter(row => {
    const d = row.timestamp;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return selectedMonths.includes(key);
  });
}
