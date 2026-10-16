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
    dotClassName: 'bg-(--data-gray-color-muted)',
    segmentClassName: 'bg-(--data-gray-color-muted)',
  },
  light: {
    dotClassName: 'bg-(--data-blue-color-muted)',
    segmentClassName: 'bg-(--data-blue-color-muted)',
  },
  typical: {
    dotClassName: 'bg-(--data-blue-color-emphasis)/50',
    segmentClassName: 'bg-(--data-blue-color-emphasis)/50',
  },
  heavy: {
    dotClassName: 'bg-(--data-blue-color-emphasis)',
    segmentClassName: 'bg-(--data-blue-color-emphasis)',
  },
  power: {
    dotClassName: 'bg-(--data-purple-color-emphasis)',
    segmentClassName: 'bg-(--data-purple-color-emphasis)',
  },
};

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getHeatmapCellClass(value: number, maxValue: number): string {
  if (value === 0 || maxValue === 0) return 'bg-(--bgColor-muted) text-(--fgColor-muted)';

  const intensity = value / maxValue;

  if (intensity >= 0.8) return 'bg-(--data-blue-color-emphasis) text-(--fgColor-onEmphasis)';
  if (intensity >= 0.6) return 'bg-(--data-blue-color-emphasis)/75 text-(--fgColor-default)';
  if (intensity >= 0.4) return 'bg-(--data-blue-color-emphasis)/55 text-(--fgColor-default)';
  if (intensity >= 0.2) return 'bg-(--data-blue-color-emphasis)/35 text-(--fgColor-default)';
  if (intensity >= 0.05) return 'bg-(--data-blue-color-emphasis)/20 text-(--fgColor-default)';

  return 'bg-(--data-blue-color-muted) text-(--fgColor-default)';
}

function getSegmentLabelClass(groupKey: UserAicGroupKey): string {
  if (groupKey === 'heavy' || groupKey === 'power') return 'text-(--fgColor-onEmphasis)';

  return 'text-(--fgColor-default)';
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
        <p className="text-sm font-medium text-(--fgColor-default)">{title}</p>
        <p className="text-xs text-(--fgColor-muted)">100% stacked distribution</p>
      </div>
      <div className="h-10 flex overflow-hidden rounded-md border border-(--borderColor-default) bg-(--bgColor-muted)">
        {groups.map((group) => {
          const share = group[metric];

          if (share <= 0) return null;

          return (
            <div
              key={group.key}
              className={`${GROUP_STYLES[group.key].segmentClassName} flex items-center justify-center border-r border-(--bgColor-default) last:border-r-0`}
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
      <div className="flex items-center justify-center h-64 text-(--fgColor-muted) text-sm">
        No users match the current filters
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-md border border-(--borderColor-default) bg-(--bgColor-default) p-4">
        <DistributionBar groups={distribution.groups} metric="shareOfUsers" title="Users by group" />
        <DistributionBar groups={distribution.groups} metric="shareOfGrossCost" title="Gross cost by group" />
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-(--fgColor-muted)">
          {distribution.groups.map((group) => (
            <span key={group.key} className="inline-flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${GROUP_STYLES[group.key].dotClassName}`} aria-hidden="true" />
              {group.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-auto border border-(--borderColor-default) rounded-md">
        <table className="min-w-full" aria-label="AI Credits user group heatmap">
          <thead>
            <tr className="border-b border-(--borderColor-default)">
              <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                Group
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                Users
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                User share
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                Avg gross cost
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                Gross cost
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                Gross share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--borderColor-default)">
            {distribution.groups.map((group) => (
              <tr key={group.key} className="hover:bg-(--bgColor-muted) transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-(--fgColor-default)">
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${GROUP_STYLES[group.key].dotClassName}`} aria-hidden="true" />
                    {group.label}
                  </span>
                  <p className="mt-0.5 text-xs font-normal text-(--fgColor-muted)">{group.description}</p>
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
