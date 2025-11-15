import { ProcessedData } from '@/types/csv';

export interface WeeklyExhaustionData {
  week1Exhausted: string[]; // Users who hit 100% by day 7
  week2Exhausted: string[]; // Users who hit 100% by day 14
  week3Exhausted: string[]; // Users who hit 100% by day 21
  week4Exhausted: string[]; // Users who hit 100% by day 28
  currentPeriodOnly: boolean;
}

/**
 * Analyzes when users exhaust their quota within the first 21 days of the month
 * This helps identify power users who might benefit from per-request billing
 */
export function analyzeWeeklyQuotaExhaustion(
  processedData: ProcessedData[]
): WeeklyExhaustionData {
  const userExhaustionDates = new Map<string, number>(); // day of month when hit 100%
  
  // Group by user and find when they hit 100%
  const userGroups = new Map<string, ProcessedData[]>();
  for (const entry of processedData) {
    let arr = userGroups.get(entry.user);
    if (!arr) { arr = []; userGroups.set(entry.user, arr); }
    arr.push(entry);
  }
  
  userGroups.forEach((entries, user) => {
    // Resolve user quota from first occurrence in processedData (O(1) after map build)
    const userQuota = entries.length ? entries[0].quotaValue : 'unlimited';
    if (userQuota === 'unlimited') return;
    
    // Sort by date and calculate cumulative usage
    const sorted = [...entries].sort((a, b) => a.epoch - b.epoch);
    
    let cumulative = 0;
    for (const entry of sorted) {
      cumulative += entry.requestsUsed;
      if (cumulative >= userQuota) {
        const exhaustionDay = entry.timestamp.getUTCDate();
        userExhaustionDates.set(user, exhaustionDay);
        break;
      }
    }
  });
  
  // Categorize by weeks (1-7, 8-14, 15-21, 22-28)
  const week1Exhausted: string[] = [];
  const week2Exhausted: string[] = [];
  const week3Exhausted: string[] = [];
  const week4Exhausted: string[] = [];
  
  userExhaustionDates.forEach((day, user) => {
    if (day <= 7) {
      week1Exhausted.push(user);
    } else if (day <= 14) {
      week2Exhausted.push(user);
    } else if (day <= 21) {
      week3Exhausted.push(user);
    } else if (day <= 28) {
      week4Exhausted.push(user);
    }
  });
  
  return {
    week1Exhausted,
    week2Exhausted,
    week3Exhausted,
    week4Exhausted,
    currentPeriodOnly: true
  };
}

/**
 * Gets all users who exhausted quota before day 28 (combines first four weeks)
 */
export function getEarlyExhausterUsers(weeklyExhaustion: WeeklyExhaustionData): string[] {
  return [
    ...weeklyExhaustion.week1Exhausted,
    ...weeklyExhaustion.week2Exhausted,
    ...weeklyExhaustion.week3Exhausted,
    ...weeklyExhaustion.week4Exhausted
  ];
}