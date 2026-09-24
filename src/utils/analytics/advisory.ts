import type { ProcessedData } from '@/types/csv';
import type { WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';

import { categorizeUserConsumption, type UserConsumptionCategory } from './insights';
import type { UserSummary } from './types';

export interface Advisory {
  type: 'spendingBudget' | 'training';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  affectedUsers: number;
  estimatedImpact?: string;
  documentationLink?: string;
}

export function getEarlyExhausterCount(weeklyExhaustion: WeeklyQuotaExhaustionBreakdown): number {
  return weeklyExhaustion.weeks
    .filter(week => week.weekNumber <= 4)
    .reduce((total, week) => total + week.usersExhaustedInWeek, 0);
}

/**
 * Build the AI Credit budget advisory shared by the row and artifact paths.
 * Severity escalates to 'high' when early exhausters represent >=30% of users.
 */
function buildSpendingBudgetAdvisory(
  earlyExhausterCount: number,
  earlyExhausterPercentage: number
): Advisory {
  const severity: Advisory['severity'] = earlyExhausterPercentage >= 0.30 ? 'high' : 'medium';
  return {
    type: 'spendingBudget',
    severity,
    title: 'Review AI Credit Budgets for Power Users',
    description: `${earlyExhausterCount} user${earlyExhausterCount === 1 ? '' : 's'} (${(earlyExhausterPercentage * 100).toFixed(0)}%) exhaust their AI Credit quota before day 28 of the month. Review their additional usage and spending limits.`,
    actionItems: [
      'Review power user consumption patterns in detail',
      'Set up AI Credit budgets for high-consumption users',
      'Configure spending limits to control costs',
      'Consider upgrading to a higher plan for consistent power users'
    ],
    affectedUsers: earlyExhausterCount,
    documentationLink: 'https://docs.github.com/en/enterprise-cloud@latest/billing/tutorials/set-up-budgets#managing-budgets-for-your-organization-or-enterprise'
  };
}

/**
 * Build the training advisory shared by the row and artifact paths.
 */
function buildTrainingAdvisory(
  lowAdoptionUsers: UserConsumptionCategory[],
  lowUtilizationPercentage: number
): Advisory {
  return {
    type: 'training',
    severity: 'medium',
    title: 'Training Opportunity for Low-Adoption Users',
    description: `${lowAdoptionUsers.length} users (${(lowUtilizationPercentage * 100).toFixed(0)}%) are using less than 20% of their included AI Credits, indicating potential adoption challenges.`,
    actionItems: [
      'Schedule GitHub Copilot training sessions focusing on best practices',
      'Share success stories from power users within your organization',
      'Create internal documentation with relevant use cases',
      'Set up pair programming sessions between power users and low-adoption users',
      'Consider creating internal Copilot champions program'
    ],
    affectedUsers: lowAdoptionUsers.length,
    documentationLink: 'https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/roll-out-at-scale/enable-developers/drive-adoption#supporting-effective-use-of-copilot-in-your-organization'
  };
}

export function buildAdvisoriesFromCategories(
  lowAdoptionUsers: UserConsumptionCategory[],
  totalUsers: number,
  earlyExhausterCount: number
): Advisory[] {
  const advisories: Advisory[] = [];
  if (totalUsers === 0) return advisories;

  // Recommend reviewing budgets whenever users exhaust their credits early.
  const earlyExhausterPercentage = earlyExhausterCount / Math.max(1, totalUsers);
  if (earlyExhausterCount > 0) {
    advisories.push(buildSpendingBudgetAdvisory(earlyExhausterCount, earlyExhausterPercentage));
  }

  const lowUtilizationPercentage = lowAdoptionUsers.length / Math.max(1, totalUsers);
  if (lowUtilizationPercentage >= 0.40) {
    advisories.push(buildTrainingAdvisory(lowAdoptionUsers, lowUtilizationPercentage));
  }

  return advisories;
}

export function generateAdvisories(
  userData: UserSummary[],
  processedData: ProcessedData[],
  weeklyExhaustion: WeeklyQuotaExhaustionBreakdown
): Advisory[] {
  const totalUsers = userData.length;
  if (totalUsers === 0) return [];

  const earlyExhausterCount = getEarlyExhausterCount(weeklyExhaustion);
  const { lowAdoptionUsers } = categorizeUserConsumption(userData, processedData);

  return buildAdvisoriesFromCategories(lowAdoptionUsers, totalUsers, earlyExhausterCount);
}
