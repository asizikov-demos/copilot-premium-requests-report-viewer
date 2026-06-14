'use client';

import { useMemo } from 'react';

import type { BillingUserTotals } from '@/utils/ingestion';
import { buildUserAicDistribution } from '@/utils/analytics/userAicDistribution';
import type { UserAicGroup, UserAicGroupKey } from '@/utils/analytics/userAicDistribution';
import { formatCurrency } from '@/utils/formatters';

interface UsersAicDistributionChartProps {
  users: BillingUserTotals[];
}

interface GroupStyle {
  dotClassName: string;
  segmentClassName: string;
}

const GROUP_STYLES: Record<UserAicGroupKey, GroupStyle> = {
  nearZero: {
    dotClassName: 'bg-[#d1d9e0]',
    segmentClassName: 'bg-[#d1d9e0]',
  },
  light: {
    dotClassName: 'bg-[#bfdbfe]',
    segmentClassName: 'bg-[#bfdbfe]',
  },
  typical: {
    dotClassName: 'bg-[#60a5fa]',
    segmentClassName: 'bg-[#60a5fa]',
  },
  heavy: {
    dotClassName: 'bg-indigo-500',
    segmentClassName: 'bg-indigo-500',
  },
  power: {
    dotClassName: 'bg-[#8b5cf6]',
    segmentClassName: 'bg-[#8b5cf6]',
  },
};

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getHeatmapCellClass(value: number, maxValue: number): string {
  if (value === 0 || maxValue === 0) return 'bg-[#f9fafb] text-[#636c76]';

  const intensity = value / maxValue;

  if (intensity >= 0.8) return 'bg-[#1d4ed8] text-white';
  if (intensity >= 0.6) return 'bg-[#3b82f6] text-white';
  if (intensity >= 0.4) return 'bg-[#60a5fa] text-[#1f2328]';
  if (intensity >= 0.2) return 'bg-[#93c5fd] text-[#1f2328]';
  if (intensity >= 0.05) return 'bg-[#bfdbfe] text-[#1f2328]';

  return 'bg-[#dbeafe] text-[#1f2328]';
}

function getSegmentLabelClass(groupKey: UserAicGroupKey): string {
  if (groupKey === 'heavy' || groupKey === 'power') return 'text-white';

  return 'text-[#1f2328]';
}

function DistributionBar({
  groups,
  metric,
  title,
}: {
  groups: UserAicGroup[];
  metric: 'shareOfUsers' | 'shareOfGrossCost';
  title: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#1f2328]">{title}</p>
        <p className="text-xs text-[#636c76]">100% stacked distribution</p>
      </div>
      <div className="h-10 flex overflow-hidden rounded-md border border-[#d1d9e0] bg-[#f6f8fa]">
        {groups.map((group) => {
          const share = group[metric];

          if (share <= 0) return null;

          return (
            <div
              key={group.key}
              className={`${GROUP_STYLES[group.key].segmentClassName} flex items-center justify-center border-r border-[#ffffff] last:border-r-0`}
              style={{ width: `${share}%` }}
              title={`${group.label}: ${formatPercentage(share)}`}
            >
              {share >= 8 ? (
                <span className={`px-1 text-xs font-semibold ${getSegmentLabelClass(group.key)}`}>
                  {formatPercentage(share)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UsersAicDistributionChart({ users }: UsersAicDistributionChartProps) {
  const distribution = useMemo(() => buildUserAicDistribution(users), [users]);
  const maxUsers = Math.max(...distribution.groups.map((group) => group.users), 0);
  const maxUserShare = Math.max(...distribution.groups.map((group) => group.shareOfUsers), 0);
  const maxAverageGrossCost = Math.max(...distribution.groups.map((group) => group.averageGrossCost), 0);
  const maxTotalGrossCost = Math.max(...distribution.groups.map((group) => group.totalGrossCost), 0);
  const maxGrossCostShare = Math.max(...distribution.groups.map((group) => group.shareOfGrossCost), 0);

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
        No users match the current filters
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-md border border-[#d1d9e0] bg-white p-4">
        <DistributionBar groups={distribution.groups} metric="shareOfUsers" title="Users by group" />
        <DistributionBar groups={distribution.groups} metric="shareOfGrossCost" title="Gross cost by group" />
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#636c76]">
          {distribution.groups.map((group) => (
            <span key={group.key} className="inline-flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${GROUP_STYLES[group.key].dotClassName}`} aria-hidden="true" />
              {group.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-auto border border-[#d1d9e0] rounded-md">
        <table className="min-w-full" aria-label="AI Credits user group heatmap">
          <thead>
            <tr className="border-b border-[#d1d9e0]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Group
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Users
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                User share
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Avg gross cost
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Gross cost
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Gross share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d1d9e0]">
            {distribution.groups.map((group) => (
              <tr key={group.key} className="hover:bg-[#fcfdff] transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${GROUP_STYLES[group.key].dotClassName}`} aria-hidden="true" />
                    {group.label}
                  </span>
                  <p className="mt-0.5 text-xs font-normal text-[#636c76]">{group.description}</p>
                </td>
                <td className={`px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-right ${getHeatmapCellClass(group.users, maxUsers)}`}>
                  {group.users.toLocaleString()}
                </td>
                <td className={`px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-right ${getHeatmapCellClass(group.shareOfUsers, maxUserShare)}`}>
                  {formatPercentage(group.shareOfUsers)}
                </td>
                <td className={`px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-right ${getHeatmapCellClass(group.averageGrossCost, maxAverageGrossCost)}`}>
                  {formatCurrency(group.averageGrossCost)}
                </td>
                <td className={`px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums font-semibold text-right ${getHeatmapCellClass(group.totalGrossCost, maxTotalGrossCost)}`}>
                  {formatCurrency(group.totalGrossCost)}
                </td>
                <td className={`px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-right ${getHeatmapCellClass(group.shareOfGrossCost, maxGrossCostShare)}`}>
                  {formatPercentage(group.shareOfGrossCost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
