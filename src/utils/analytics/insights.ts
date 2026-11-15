export interface UserConsumptionCategory {
  user: string;
  totalCredits: number;
  quota: number | 'unknown';
  consumptionPercentage: number;
  category: 'power' | 'average' | 'low' | 'unknown';
}

export interface InsightsOverviewData {
  powerUsers: UserConsumptionCategory[];
  averageUsers: UserConsumptionCategory[];
  lowAdoptionUsers: UserConsumptionCategory[];
}

export interface FeatureUtilizationStats {
  codeReview: { totalCredits: number; averagePerUser: number; userCount: number; };
  codingAgent: { totalCredits: number; averagePerUser: number; userCount: number; };
  spark: { totalCredits: number; averagePerUser: number; userCount: number; };
  codeQuality: { totalCredits: number; averagePerUser: number; userCount: number; };
}

export const CONSUMPTION_THRESHOLDS = Object.freeze({
  powerMinPct: 90,
  averageMinPct: 45
});

export function classifyConsumptionUser(
  totalCredits: number,
  quota: number | 'unknown'
): { consumptionPercentage: number; category: UserConsumptionCategory['category'] } {
  if (typeof quota !== 'number' || quota <= 0) {
    return { consumptionPercentage: 0, category: 'unknown' };
  }
  const consumptionPercentage = (totalCredits / quota) * 100;
  let category: UserConsumptionCategory['category'] = 'low';
  if (consumptionPercentage >= CONSUMPTION_THRESHOLDS.powerMinPct) category = 'power';
  else if (consumptionPercentage >= CONSUMPTION_THRESHOLDS.averageMinPct) category = 'average';
  return { consumptionPercentage, category };
}
