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

import type { BillingUserTotals } from '@/utils/ingestion';
import { buildUserAicClusters } from '@/utils/analytics/userAicClusters';
import type { UserAicClusterKey } from '@/utils/analytics/userAicClusters';
import { formatCurrency } from '@/utils/formatters';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

interface UsersAicClustersChartProps {
  users: BillingUserTotals[];
}

interface ClusterStyle {
  fill: string;
  dotClassName: string;
}

const CLUSTER_STYLES: Record<UserAicClusterKey, ClusterStyle> = {
  power: { fill: '#8b5cf6', dotClassName: 'bg-[#8b5cf6]' },
  heavy: { fill: '#6366f1', dotClassName: 'bg-indigo-500' },
  typical: { fill: '#60a5fa', dotClassName: 'bg-[#60a5fa]' },
  light: { fill: '#8c959f', dotClassName: 'bg-[#8c959f]' },
  nearZero: { fill: '#d1d9e0', dotClassName: 'bg-[#d1d9e0]' },
};

export function UsersAicClustersChart({ users }: UsersAicClustersChartProps) {
  const clusters = useMemo(() => buildUserAicClusters(users), [users]);

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
              name="Avg usage quantity"
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
              tickFormatter={(value) => formatCurrency(Number(value))}
            />
            <ZAxis type="number" dataKey="users" range={[90, 900]} name="Users" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#d1d9e0' }}
              contentStyle={chartTooltipContentStyle}
              labelStyle={chartTooltipLabelStyle}
              formatter={(value, name) => {
                if (name === 'Avg AI Credits gross') return [formatCurrency(Number(value)), name];
                if (name === 'Avg usage quantity') return [Number(value).toFixed(1), name];
                return [Number(value).toLocaleString(), name];
              }}
            />
            <Scatter name="User clusters" data={clusters} fill="#6366f1">
              {clusters.map((cluster) => (
                <Cell key={cluster.cluster} fill={CLUSTER_STYLES[cluster.key].fill} />
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
                Avg Usage Quantity
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
                      className={`w-2.5 h-2.5 rounded-full ${CLUSTER_STYLES[cluster.key].dotClassName}`}
                      aria-hidden="true"
                    />
                    {cluster.cluster}
                  </span>
                  <p className="mt-0.5 text-xs font-normal text-[#636c76]">
                    {formatCurrency(cluster.minAicGrossAmount)}-{formatCurrency(cluster.maxAicGrossAmount)} per user
                  </p>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                  {cluster.users.toLocaleString()}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">
                  {formatCurrency(cluster.averageAicGrossAmount)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums font-semibold text-[#1f2328] text-right">
                  {formatCurrency(cluster.totalAicGrossAmount)}
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
