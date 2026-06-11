import type { BillingUserTotals } from '@/utils/ingestion';

interface UserAicPoint {
  totalRequests: number;
  aicGrossAmount: number;
}

export type UserAicClusterKey = 'power' | 'heavy' | 'typical' | 'light' | 'nearZero';

export interface UserAicCluster {
  key: UserAicClusterKey;
  cluster: string;
  users: number;
  averageRequests: number;
  averageAicGrossAmount: number;
  totalRequests: number;
  totalAicGrossAmount: number;
  minAicGrossAmount: number;
  maxAicGrossAmount: number;
  shareOfAicGrossAmount: number;
}

interface ClusterBucket {
  key: UserAicClusterKey;
  label: string;
  points: UserAicPoint[];
}

export const NEAR_ZERO_AIC_GROSS_AMOUNT_USD = 1;

function summarizeCluster(
  key: UserAicClusterKey,
  cluster: string,
  points: UserAicPoint[],
  totalAicGrossAmount: number
): UserAicCluster {
  const totalRequests = points.reduce((sum, point) => sum + point.totalRequests, 0);
  const clusterAicGrossAmount = points.reduce((sum, point) => sum + point.aicGrossAmount, 0);
  const sortedSpend = points.map((point) => point.aicGrossAmount).sort((a, b) => a - b);

  return {
    key,
    cluster,
    users: points.length,
    averageRequests: totalRequests / points.length,
    averageAicGrossAmount: clusterAicGrossAmount / points.length,
    totalRequests,
    totalAicGrossAmount: clusterAicGrossAmount,
    minAicGrossAmount: sortedSpend[0] ?? 0,
    maxAicGrossAmount: sortedSpend[sortedSpend.length - 1] ?? 0,
    shareOfAicGrossAmount: totalAicGrossAmount > 0 ? (clusterAicGrossAmount / totalAicGrossAmount) * 100 : 0,
  };
}

function buildPercentileBuckets(spendingUsers: UserAicPoint[]): ClusterBucket[] {
  const spendingUserCount = spendingUsers.length;
  const powerCount = getBandUserCount(spendingUserCount, spendingUserCount, 0.05);
  let remainingUserCount = spendingUserCount - powerCount;

  const heavyCount = getBandUserCount(spendingUserCount, remainingUserCount, 0.15);
  remainingUserCount -= heavyCount;

  const lightCount = getBandUserCount(spendingUserCount, remainingUserCount, 0.25);
  remainingUserCount -= lightCount;

  const typicalCount = remainingUserCount;
  let cursor = 0;

  const lightUsers = spendingUsers.slice(cursor, cursor + lightCount);
  cursor += lightCount;

  const typicalUsers = spendingUsers.slice(cursor, cursor + typicalCount);
  cursor += typicalCount;

  const heavyUsers = spendingUsers.slice(cursor, cursor + heavyCount);
  cursor += heavyCount;

  const powerUsers = spendingUsers.slice(cursor, cursor + powerCount);

  return [
    { key: 'power', label: 'Power Users', points: powerUsers },
    { key: 'heavy', label: 'Heavy Users', points: heavyUsers },
    { key: 'typical', label: 'Typical users', points: typicalUsers },
    { key: 'light', label: 'Light users', points: lightUsers },
  ];
}

function getBandUserCount(totalUsers: number, remainingUsers: number, share: number): number {
  if (remainingUsers === 0) return 0;

  return Math.min(remainingUsers, Math.max(1, Math.round(totalUsers * share)));
}

export function buildUserAicClusters(users: BillingUserTotals[]): UserAicCluster[] {
  const points = users.map((user) => ({
    totalRequests: user.quantity,
    aicGrossAmount: user.aicGrossAmount ?? 0,
  }));

  const totalAicGrossAmount = points.reduce((sum, point) => sum + point.aicGrossAmount, 0);
  const nearZeroUsers = points.filter((point) => point.aicGrossAmount < NEAR_ZERO_AIC_GROSS_AMOUNT_USD);
  const spendingUsers = points
    .filter((point) => point.aicGrossAmount >= NEAR_ZERO_AIC_GROSS_AMOUNT_USD)
    .sort((a, b) => a.aicGrossAmount - b.aicGrossAmount);

  const percentileBuckets = buildPercentileBuckets(spendingUsers);
  const nearZeroBucket: ClusterBucket = {
    key: 'nearZero',
    label: 'Near-zero users',
    points: nearZeroUsers,
  };

  return [...percentileBuckets, nearZeroBucket]
    .filter((bucket) => bucket.points.length > 0)
    .map((bucket) => summarizeCluster(bucket.key, bucket.label, bucket.points, totalAicGrossAmount));
}
