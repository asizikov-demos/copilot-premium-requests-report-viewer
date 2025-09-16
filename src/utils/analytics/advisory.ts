import { UserSummary } from './transformations';
import { categorizeUserConsumption, UserConsumptionCategory, calculateUnusedValue as calculateUnusedValueFromInsights } from './insights';
import { ProcessedData } from '@/types/csv';
import { WeeklyExhaustionData, getEarlyExhausterUsers } from './weeklyQuota';
import { PRICING } from '@/constants/pricing';

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
 * Generates advisory recommendations based on user consumption patterns
 * - Per-request billing for power users (30% threshold)
 * - Training for low-utilization users (40% threshold)
 */
export function generateAdvisories(
  userData: UserSummary[],
  processedData: ProcessedData[],
  weeklyExhaustion: WeeklyExhaustionData
): Advisory[] {
  const advisories: Advisory[] = [];
  const totalUsers = userData.length;
  
  if (totalUsers === 0) return advisories;
  
  // Check for per-request billing recommendation (30% threshold for power users)
  const earlyExhausterUsers = getEarlyExhausterUsers(weeklyExhaustion);
  const earlyExhausterPercentage = earlyExhausterUsers.length / totalUsers;
  
  if (earlyExhausterPercentage >= 0.30) {
    advisories.push({
      type: 'perRequestBilling',
      severity: 'high',
      title: 'Consider Per-Request Billing for Power Users',
      description: `${earlyExhausterUsers.length} users (${(earlyExhausterPercentage * 100).toFixed(0)}%) exhaust their quota before day 21 of the month. These power users could benefit from per-request billing to avoid disruption.`,
      actionItems: [
        'Review power user consumption patterns in detail',
        'Set up per-request billing budgets for high-consumption users',
        'Configure spending limits to control costs',
        'Consider increasing base licenses for consistent power users'
      ],
      affectedUsers: earlyExhausterUsers.length,
      estimatedImpact: `Additional cost: ~$${(earlyExhausterUsers.length * 50 * PRICING.OVERAGE_RATE_PER_REQUEST).toFixed(0)}/month (assuming 50 extra requests per user)`,
      documentationLink: 'https://docs.github.com/en/enterprise-cloud@latest/billing/tutorials/set-up-budgets#managing-budgets-for-your-organization-or-enterprise'
    });
  }
  
  // Check for training recommendation (40% threshold for low utilization)
  const { lowAdoptionUsers } = categorizeUserConsumption(userData, processedData);
  const lowUtilizationPercentage = lowAdoptionUsers.length / totalUsers;
  
  if (lowUtilizationPercentage >= 0.40) {
    const unusedValue = calculateUnusedValueFromInsights(lowAdoptionUsers);
    
    advisories.push({
      type: 'training',
      severity: 'medium',
      title: 'Training Opportunity for Low-Utilization Users',
      description: `${lowAdoptionUsers.length} users (${(lowUtilizationPercentage * 100).toFixed(0)}%) are using less than 20% of their included premium requests, indicating potential adoption challenges.`,
      actionItems: [
        'Schedule GitHub Copilot training sessions focusing on best practices',
        'Share success stories from power users within your organization',
        'Create internal documentation with relevant use cases',
        'Set up pair programming sessions between power users and low-adoption users',
        'Consider creating internal Copilot champions program'
      ],
      affectedUsers: lowAdoptionUsers.length,
      estimatedImpact: `Unused value: ~$${unusedValue.toFixed(0)}/month`,
    });
  }
  
  return advisories;
}