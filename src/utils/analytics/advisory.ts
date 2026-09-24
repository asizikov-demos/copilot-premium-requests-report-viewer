import type { ProcessedData } from '@/types/csv';

import { categorizeUserConsumption, CONSUMPTION_THRESHOLDS, type UserConsumptionCategory } from './insights';
import type { UserSummary } from './types';

export interface Advisory {
  type: 'training';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  affectedUsers: number;
  estimatedImpact?: string;
  documentationLink?: string;
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
    description: `${lowAdoptionUsers.length} users (${(lowUtilizationPercentage * 100).toFixed(0)}%) are using less than ${CONSUMPTION_THRESHOLDS.averageMinPct}% of their included AI Credits. Ask about workflow fit and access barriers; consumption alone is not a measure of productivity.`,
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
  totalUsers: number
): Advisory[] {
  const advisories: Advisory[] = [];
  if (totalUsers === 0) return advisories;

  const lowUtilizationPercentage = lowAdoptionUsers.length / Math.max(1, totalUsers);
  if (lowUtilizationPercentage >= 0.40) {
    advisories.push(buildTrainingAdvisory(lowAdoptionUsers, lowUtilizationPercentage));
  }

  return advisories;
}

export function generateAdvisories(
  userData: UserSummary[],
  processedData: ProcessedData[]
): Advisory[] {
  const totalUsers = userData.length;
  if (totalUsers === 0) return [];

  const { lowAdoptionUsers } = categorizeUserConsumption(userData, processedData);

  return buildAdvisoriesFromCategories(lowAdoptionUsers, totalUsers);
}
