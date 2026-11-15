export function filterDailySeriesByMonths<T extends { date: string }>(data: T[], selectedMonths: string[]): T[] {
  if (selectedMonths.length === 0) return data;
  const selSet = new Set(selectedMonths);
  return data.filter(datum => selSet.has(datum.date.slice(0, 7)));
}
