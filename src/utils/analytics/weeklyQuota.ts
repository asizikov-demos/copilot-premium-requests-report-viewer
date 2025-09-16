import { ProcessedData } from '@/types/csv';
import { getUserQuotaValue } from './index';

export interface WeeklyExhaustionData {
  week1Exhausted: string[]; // Users who hit 100% by day 7
  week2Exhausted: string[]; // Users who hit 100% by day 14
  week3Exhausted: string[]; // Users who hit 100% by day 21
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
  processedData.forEach(entry => {
    if (!userGroups.has(entry.user)) {
      userGroups.set(entry.user, []);
    }
    userGroups.get(entry.user)!.push(entry);
  });
  
  userGroups.forEach((entries, user) => {
    const userQuota = getUserQuotaValue(processedData, user);
    if (userQuota === 'unlimited') return;
    
    // Sort by date and calculate cumulative usage
    const sorted = [...entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    let cumulative = 0;
    for (const entry of sorted) {
      cumulative += entry.requestsUsed;
      if (cumulative >= userQuota) {
        const exhaustionDay = new Date(entry.timestamp).getUTCDate();
        userExhaustionDates.set(user, exhaustionDay);
        break;
      }
    }
  });
  
  // Categorize by weeks (1-7, 8-14, 15-21)
  const week1Exhausted: string[] = [];
  const week2Exhausted: string[] = [];
  const week3Exhausted: string[] = [];
  
  userExhaustionDates.forEach((day, user) => {
    if (day <= 7) {
      week1Exhausted.push(user);
    } else if (day <= 14) {
      week2Exhausted.push(user);
    } else if (day <= 21) {
      week3Exhausted.push(user);
    }
  });
  
  return {
    week1Exhausted,
    week2Exhausted,
    week3Exhausted,
    currentPeriodOnly: true
  };
}

/**
 * Gets all users who exhausted quota before day 21 (combines all three weeks)
 */
export function getEarlyExhausterUsers(weeklyExhaustion: WeeklyExhaustionData): string[] {
  return [
    ...weeklyExhaustion.week1Exhausted,
    ...weeklyExhaustion.week2Exhausted,
    ...weeklyExhaustion.week3Exhausted
  ];
}