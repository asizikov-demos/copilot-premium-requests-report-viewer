import { getEffectiveAicQuantity } from '@/utils/aicFields';
import { PRICING } from '@/constants/pricing';
import type { BillingUserTotals } from '@/utils/ingestion';

export type UserAicGroupKey = 'nearZero' | 'light' | 'typical' | 'heavy' | 'power';

export interface UserAicGroup {
  key: UserAicGroupKey;
  label: string;
  description: string;
  users: number;
  totalAiCredits: number;
  averageAiCredits: number;
  totalGrossCost: number;
  averageGrossCost: number;
  minAiCredits: number;
  maxAiCredits: number;
  shareOfUsers: number;
  shareOfAiCredits: number;
  shareOfGrossCost: number;
}

export interface UserAicDistribution {
  groups: UserAicGroup[];
  totalUsers: number;
  activeUsers: number;
  totalAiCredits: number;
  totalGrossCost: number;
}

interface UserAicPoint {
  aiCredits: number;
  grossCost: number;
}

interface GroupDefinition {
  key: UserAicGroupKey;
  label: string;
  description: string;
}

interface GroupBucket extends GroupDefinition {
  points: UserAicPoint[];
}

export const NEAR_ZERO_AIC_QUANTITY = 1;

const GROUP_DEFINITIONS: Record<UserAicGroupKey, GroupDefinition> = {
  nearZero: {
    key: 'nearZero',
    label: 'Near-zero',
    description: '< 1 AI Credit',
  },
  light: {
    key: 'light',
    label: 'Light',
    description: 'Bottom 25% of active users',
  },
  typical: {
    key: 'typical',
    label: 'Typical',
    description: 'Middle 55% of active users',
  },
  heavy: {
    key: 'heavy',
    label: 'Heavy',
    description: 'Next 15% of active users',
  },
  power: {
    key: 'power',
    label: 'Power',
    description: 'Top 5% of active users',
  },
};

function getBandUserCount(totalUsers: number, remainingUsers: number, share: number): number {
  if (remainingUsers === 0) return 0;

  return Math.min(remainingUsers, Math.max(1, Math.round(totalUsers * share)));
}

function buildActiveUserGroups(activeUsers: UserAicPoint[]): GroupBucket[] {
  const activeUserCount = activeUsers.length;
  const powerCount = getBandUserCount(activeUserCount, activeUserCount, 0.05);
  let remainingUserCount = activeUserCount - powerCount;

  const heavyCount = getBandUserCount(activeUserCount, remainingUserCount, 0.15);
  remainingUserCount -= heavyCount;

  const lightCount = getBandUserCount(activeUserCount, remainingUserCount, 0.25);
  remainingUserCount -= lightCount;

  const typicalCount = remainingUserCount;
  let cursor = 0;

  const lightUsers = activeUsers.slice(cursor, cursor + lightCount);
  cursor += lightCount;

  const typicalUsers = activeUsers.slice(cursor, cursor + typicalCount);
  cursor += typicalCount;

  const heavyUsers = activeUsers.slice(cursor, cursor + heavyCount);
  cursor += heavyCount;

  const powerUsers = activeUsers.slice(cursor, cursor + powerCount);

  return [
    { ...GROUP_DEFINITIONS.light, points: lightUsers },
    { ...GROUP_DEFINITIONS.typical, points: typicalUsers },
    { ...GROUP_DEFINITIONS.heavy, points: heavyUsers },
    { ...GROUP_DEFINITIONS.power, points: powerUsers },
  ];
}

function summarizeGroup(
  group: GroupBucket,
  totalUsers: number,
  totalAiCredits: number,
  totalGrossCost: number
): UserAicGroup {
  const groupAiCredits = group.points.reduce((sum, point) => sum + point.aiCredits, 0);
  const groupGrossCost = group.points.reduce((sum, point) => sum + point.grossCost, 0);
  const aiCreditValues = group.points.map((point) => point.aiCredits);

  return {
    key: group.key,
    label: group.label,
    description: group.description,
    users: group.points.length,
    totalAiCredits: groupAiCredits,
    averageAiCredits: group.points.length > 0 ? groupAiCredits / group.points.length : 0,
    totalGrossCost: groupGrossCost,
    averageGrossCost: group.points.length > 0 ? groupGrossCost / group.points.length : 0,
    minAiCredits: aiCreditValues.length > 0 ? Math.min(...aiCreditValues) : 0,
    maxAiCredits: aiCreditValues.length > 0 ? Math.max(...aiCreditValues) : 0,
    shareOfUsers: totalUsers > 0 ? (group.points.length / totalUsers) * 100 : 0,
    shareOfAiCredits: totalAiCredits > 0 ? (groupAiCredits / totalAiCredits) * 100 : 0,
    shareOfGrossCost: totalGrossCost > 0 ? (groupGrossCost / totalGrossCost) * 100 : 0,
  };
}

export function buildUserAicDistribution(users: BillingUserTotals[]): UserAicDistribution {
  const points = users.map((user) => {
    const aiCredits = getEffectiveAicQuantity(user);

    return {
      aiCredits,
      grossCost: typeof user.aicGrossAmount === 'number'
        ? user.aicGrossAmount
        : aiCredits * PRICING.AI_CREDIT_USD_VALUE,
    };
  });
  const totalUsers = points.length;
  const totalAiCredits = points.reduce((sum, point) => sum + point.aiCredits, 0);
  const totalGrossCost = points.reduce((sum, point) => sum + point.grossCost, 0);
  const nearZeroUsers = points.filter((point) => point.aiCredits < NEAR_ZERO_AIC_QUANTITY);
  const activeUsers = points
    .filter((point) => point.aiCredits >= NEAR_ZERO_AIC_QUANTITY)
    .sort((a, b) => a.aiCredits - b.aiCredits);
  const nearZeroGroup: GroupBucket = {
    ...GROUP_DEFINITIONS.nearZero,
    points: nearZeroUsers,
  };
  const groups = [nearZeroGroup, ...buildActiveUserGroups(activeUsers)];
  const groupsByKey = new Map(
    groups.map((group) => [
      group.key,
      summarizeGroup(group, totalUsers, totalAiCredits, totalGrossCost),
    ])
  );
  const orderedGroupKeys: UserAicGroupKey[] = ['power', 'heavy', 'typical', 'light', 'nearZero'];

  return {
    groups: orderedGroupKeys.map((key) => groupsByKey.get(key)).filter((group): group is UserAicGroup => group !== undefined),
    totalUsers,
    activeUsers: points.filter((point) => point.aiCredits > 0).length,
    totalAiCredits,
    totalGrossCost,
  };
}
