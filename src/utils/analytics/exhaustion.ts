import { ProcessedData } from '@/types/csv';
import { dayOfMonthToWeekBucket } from '@/utils/dateKeys';

export interface WeeklyQuotaExhaustionBreakdown {
  totalUsersExhausted: number;
  weeks: Array<{ weekNumber: number; startDate: string; endDate: string; usersExhaustedInWeek: number; }>;
}

export function computeWeeklyQuotaExhaustion(data: ProcessedData[]): WeeklyQuotaExhaustionBreakdown {
  if (data.length === 0) return { totalUsersExhausted: 0, weeks: [] };
  const userEntries = new Map<string, ProcessedData[]>();
  data.forEach(r => { if (!userEntries.has(r.user)) userEntries.set(r.user, []); userEntries.get(r.user)!.push(r); });
  interface ExhaustionRecord { user: string; exhaustionDate: Date; monthKey: string; }
  const records: ExhaustionRecord[] = [];
  for (const [user, rows] of userEntries.entries()) {
    const quotaValue = rows[0].quotaValue;
    if (quotaValue === 'unlimited' || typeof quotaValue !== 'number') continue;
    const sorted = rows.sort((a, b) => a.epoch - b.epoch);
    let cumulative = 0;
    for (const r of sorted) {
      cumulative += r.requestsUsed;
      if (cumulative >= quotaValue) {
        records.push({ user, exhaustionDate: r.timestamp, monthKey: r.monthKey });
        break;
      }
    }
  }
  if (records.length === 0) return { totalUsersExhausted: 0, weeks: [] };
  interface WeekKey { monthKey: string; weekNumber: number; startDate: string; endDate: string; }
  const weekMap = new Map<string, { key: WeekKey; users: Set<string> }>();
  for (const rec of records) {
    const { weekNumber, startDate, endDate } = dayOfMonthToWeekBucket(rec.exhaustionDate.getUTCDate(), rec.monthKey);
    const mapKey = `${rec.monthKey}-W${weekNumber}`;
    if (!weekMap.has(mapKey)) weekMap.set(mapKey, { key: { monthKey: rec.monthKey, weekNumber, startDate, endDate }, users: new Set() });
    weekMap.get(mapKey)!.users.add(rec.user);
  }
  const weeks = Array.from(weekMap.values())
    .sort((a, b) => a.key.monthKey === b.key.monthKey ? a.key.weekNumber - b.key.weekNumber : a.key.monthKey.localeCompare(b.key.monthKey))
    .map(entry => ({ weekNumber: entry.key.weekNumber, startDate: entry.key.startDate, endDate: entry.key.endDate, usersExhaustedInWeek: entry.users.size }));
  return { totalUsersExhausted: records.length, weeks };
}
