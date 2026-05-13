'use client';

import { useMemo } from 'react';
import {
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import type { UserSummary } from '@/utils/analytics';
import type { BillingUserTotals } from '@/utils/ingestion';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

interface UsersAicClustersChartProps {
  users: UserSummary[];
  userCosts: Map<string, BillingUserTotals>;
}

interface UserAicPoint {
  user: string;
  totalRequests: number;
  aicGrossAmount: number;
}

interface UserAicCluster {
  cluster: string;
  users: number;
  averageRequests: number;
  averageAicGrossAmount: number;
  totalRequests: number;
  totalAicGrossAmount: number;
  minAicGrossAmount: number;
  maxAicGrossAmount: number;
  shareOfAicGrossAmount: number;
  fill: string;
  dotClassName: string;
}

const CLUSTER_COLORS = ['#8c959f', '#60a5fa', '#6366f1', '#8b5cf6'];
const CLUSTER_DOT_CLASSES = ['bg-[#8c959f]', 'bg-[#60a5fa]', 'bg-indigo-500', 'bg-[#8b5cf6]'];

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function summarizeCluster(
  cluster: string,
  points: UserAicPoint[],
  totalAicGrossAmount: number,
  fill: string,
  dotClassName: string
): UserAicCluster {
  const totalRequests = points.reduce((sum, point) => sum + point.totalRequests, 0);
  const clusterAicGrossAmount = points.reduce((sum, point) => sum + point.aicGrossAmount, 0);
  const sortedSpend = points.map((point) => point.aicGrossAmount).sort((a, b) => a - b);

  return {
    cluster,
    users: points.length,
    averageRequests: totalRequests / points.length,
    averageAicGrossAmount: clusterAicGrossAmount / points.length,
    totalRequests,
    totalAicGrossAmount: clusterAicGrossAmount,
    minAicGrossAmount: sortedSpend[0] ?? 0,
    maxAicGrossAmount: sortedSpend[sortedSpend.length - 1] ?? 0,
    shareOfAicGrossAmount: totalAicGrossAmount > 0 ? (clusterAicGrossAmount / totalAicGrossAmount) * 100 : 0,
    fill,
    dotClassName,
  };
}

function buildUserAicClusters(users: UserSummary[], userCosts: Map<string, BillingUserTotals>): UserAicCluster[] {
  const points = users.map((user) => ({
    user: user.user,
    totalRequests: user.totalRequests,
    aicGrossAmount: userCosts.get(user.user)?.aicGrossAmount ?? 0,
  }));

  const totalAicGrossAmount = points.reduce((sum, point) => sum + point.aicGrossAmount, 0);
  const noSpendUsers = points.filter((point) => point.aicGrossAmount <= 0);
  const spendingUsers = points
    .filter((point) => point.aicGrossAmount > 0)
    .sort((a, b) => a.aicGrossAmount - b.aicGrossAmount);

  const clusters: UserAicCluster[] = [];

  if (noSpendUsers.length > 0) {
    clusters.push(summarizeCluster(
      'No AIC spend',
      noSpendUsers,
      totalAicGrossAmount,
      CLUSTER_COLORS[0],
      CLUSTER_DOT_CLASSES[0]
    ));
  }

  const bucketCount = Math.min(3, spendingUsers.length);
  if (bucketCount === 0) {
    return clusters;
  }

  const bucketNames = bucketCount === 1
    ? ['AIC users']
    : bucketCount === 2
      ? ['Light AIC users', 'Heavy AIC users']
      : ['Light AIC users', 'Typical AIC users', 'Heavy AIC users'];

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor((bucketIndex * spendingUsers.length) / bucketCount);
    const end = Math.floor(((bucketIndex + 1) * spendingUsers.length) / bucketCount);
    const bucketUsers = spendingUsers.slice(start, end);

    if (bucketUsers.length > 0) {
      clusters.push(summarizeCluster(
        bucketNames[bucketIndex],
        bucketUsers,
        totalAicGrossAmount,
        CLUSTER_COLORS[Math.min(bucketIndex + 1, CLUSTER_COLORS.length - 1)],
        CLUSTER_DOT_CLASSES[Math.min(bucketIndex + 1, CLUSTER_DOT_CLASSES.length - 1)]
      ));
    }
  }

  return clusters;
}

export function UsersAicClustersChart({ users, userCosts }: UsersAicClustersChartProps) {
  const clusters = useMemo(() => buildUserAicClusters(users, userCosts), [users, userCosts]);

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
        No users match the current filters
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
        No AI Credits consumption is available for the current users
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="h-72 sm:h-96 2xl:h-[28rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 24, right: 28, bottom: 16, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              dataKey="averageRequests"
              name="Avg premium requests"
              tick={{ fontSize: 12, fill: '#636c76' }}
              axisLine={{ stroke: '#d1d9e0' }}
              tickLine={{ stroke: '#d1d9e0' }}
              tickFormatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            />
            <YAxis
              type="number"
              dataKey="averageAicGrossAmount"
              name="Avg AI Credits gross"
              tick={{ fontSize: 12, fill: '#636c76' }}
              axisLine={{ stroke: '#d1d9e0' }}
              tickLine={{ stroke: '#d1d9e0' }}
              tickFormatter={(value) => formatUsd(Number(value))}
            />
            <ZAxis type="number" dataKey="users" range={[90, 900]} name="Users" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#d1d9e0' }}
              contentStyle={chartTooltipContentStyle}
              labelStyle={chartTooltipLabelStyle}
              formatter={(value, name) => {
                if (name === 'Avg AI Credits gross') return [formatUsd(Number(value)), name];
                if (name === 'Avg premium requests') return [Number(value).toFixed(1), name];
                return [Number(value).toLocaleString(), name];
              }}
            />
            <Scatter name="User clusters" data={clusters} fill="#6366f1">
              {clusters.map((cluster) => (
                <Cell key={cluster.cluster} fill={cluster.fill} />
              ))}
              <LabelList dataKey="cluster" position="top" fill="#1f2328" fontSize={12} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-auto border border-[#d1d9e0] rounded-md">
        <table className="min-w-full" aria-label="AI Credits user clusters">
          <thead>
            <tr className="border-b border-[#d1d9e0]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Cluster
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Users
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Avg AIC Gross
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Total AIC Gross
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Avg Requests
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                AIC Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d1d9e0]">
            {clusters.map((cluster) => (
              <tr key={cluster.cluster} className="hover:bg-[#fcfdff] transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${cluster.dotClassName}`}
                      aria-hidden="true"
                    />
                    {cluster.cluster}
                  </span>
                  <p className="mt-0.5 text-xs font-normal text-[#636c76]">
                    {formatUsd(cluster.minAicGrossAmount)}-{formatUsd(cluster.maxAicGrossAmount)} per user
                  </p>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                  {cluster.users.toLocaleString()}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                  {formatUsd(cluster.averageAicGrossAmount)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums font-semibold text-[#1f2328] text-right">
                  {formatUsd(cluster.totalAicGrossAmount)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                  {cluster.averageRequests.toFixed(1)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                  {cluster.shareOfAicGrossAmount.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
