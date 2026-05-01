import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import type { WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';

import { categorizeUserConsumption, calculateUnusedValue as calculateUnusedValueFromInsights } from './insights';
import { UserSummary } from './types';

export interface Advisory {
  type: 'perRequestBilling' | 'training' | 'optimization';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  affectedUsers: number;
  estimatedImpact?: string;
  documentationLink?: string;
}

/**
 * Counts users who first exhausted quota during weeks 1-4 (days 1-28).
 * This "early exhaustion" threshold is used to flag likely candidates for
 * per-request billing before end-of-month quota disruption.
 */
export function countEarlyExhaustedUsers(weeklyExhaustion: WeeklyQuotaExhaustionBreakdown): number {
  return weeklyExhaustion.weeks.reduce((total, week) => (
    week.weekNumber <= 4 ? total + week.usersExhaustedInWeek : total
  ), 0);
}

export function generateAdvisories(
  userData: UserSummary[],
  processedData: ProcessedData[],
  weeklyExhaustion: WeeklyQuotaExhaustionBreakdown
): Advisory[] {
  const advisories: Advisory[] = [];
  const totalUsers = userData.length;
  
  if (totalUsers === 0) return advisories;
  
  // Always provide per-request billing recommendation if ANY early exhausters exist
  // Severity escalates to 'high' when they represent >=30% of users, otherwise 'medium'
  const earlyExhausterCount = countEarlyExhaustedUsers(weeklyExhaustion);
  const earlyExhausterPercentage = earlyExhausterCount / totalUsers;
  if (earlyExhausterCount > 0) {
    const severity: Advisory['severity'] = earlyExhausterPercentage >= 0.30 ? 'high' : 'medium';
    advisories.push({
      type: 'perRequestBilling',
      severity,
      title: 'Consider Per-Request Billing for Power Users',
      description: `${earlyExhausterCount} user${earlyExhausterCount === 1 ? '' : 's'} (${(earlyExhausterPercentage * 100).toFixed(0)}%) exhaust their quota before day 28 of the month. These power users could benefit from per-request billing to avoid disruption.`,
      actionItems: [
        'Review power user consumption patterns in detail',
        'Set up per-request billing budgets for high-consumption users',
        'Configure spending limits to control costs',
        'Consider upgrading to a higher plan for consistent power users'
      ],
      affectedUsers: earlyExhausterCount,
      estimatedImpact: `Indicative additional cost: ~$${(earlyExhausterCount * 50 * PRICING.OVERAGE_RATE_PER_REQUEST).toFixed(0)}/month (assuming 50 extra requests per early power user)`,
      documentationLink: 'https://docs.github.com/en/enterprise-cloud@latest/billing/tutorials/set-up-budgets#managing-budgets-for-your-organization-or-enterprise'
    });
  }
  
  const { lowAdoptionUsers } = categorizeUserConsumption(userData, processedData);
  const lowUtilizationPercentage = lowAdoptionUsers.length / totalUsers;
  
  if (lowUtilizationPercentage >= 0.40) {
    const unusedValue = calculateUnusedValueFromInsights(lowAdoptionUsers);
    
    advisories.push({
      type: 'training',
      severity: 'medium',
      title: 'Training Opportunity for Low-Adoption Users',
      description: `${lowAdoptionUsers.length} users (${(lowUtilizationPercentage * 100).toFixed(0)}%) are using less than 20% of their included premium requests, indicating potential adoption challenges.`,
      actionItems: [
        'Schedule GitHub Copilot training sessions focusing on best practices',
        'Share success stories from power users within your organization',
        'Create internal documentation with relevant use cases',
        'Set up pair programming sessions between power users and low-adoption users',
        'Consider creating internal Copilot champions program'
      ],
      affectedUsers: lowAdoptionUsers.length,
      estimatedImpact: `Unutilized value: ~$${unusedValue.toFixed(0)}/month`,
      documentationLink: 'https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/enable-developers/drive-adoption#supporting-effective-use-of-copilot-in-your-organization'
    });
  }
  
  return advisories;
}
