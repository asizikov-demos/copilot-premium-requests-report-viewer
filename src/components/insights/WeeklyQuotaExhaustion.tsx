'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

import { WeeklyExhaustionData } from '@/utils/analytics/weeklyQuota';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from '../charts/chartTooltipStyles';

type ResponsiveHeight = number | `${number}%`;

interface WeeklyQuotaExhaustionProps {
  weeklyExhaustion: WeeklyExhaustionData;
  totalUsers: number;
  height?: ResponsiveHeight;
}

interface WeeklyQuotaDatum {
  week: string;
  users: number;
  range: string; // days range for tooltip
}

export function WeeklyQuotaExhaustion({ weeklyExhaustion, totalUsers, height = 280 }: WeeklyQuotaExhaustionProps) {
  // Backward compatibility: older WeeklyExhaustionData instances may not include week4Exhausted.
  const {
    week1Exhausted,
    week2Exhausted,
    week3Exhausted,
    week4Exhausted = []
  } = weeklyExhaustion;

  const totalEarly =
    week1Exhausted.length +
    week2Exhausted.length +
    week3Exhausted.length +
    week4Exhausted.length;

  const data: WeeklyQuotaDatum[] = useMemo(() => [
    { week: 'Week 1', users: week1Exhausted.length, range: 'Days 1-7' },
    { week: 'Week 2', users: week2Exhausted.length, range: 'Days 8-14' },
    { week: 'Week 3', users: week3Exhausted.length, range: 'Days 15-21' },
    { week: 'Week 4', users: week4Exhausted.length, range: 'Days 22-28' },
  ], [week1Exhausted, week2Exhausted, week3Exhausted, week4Exhausted]);

  return (
    <div className="space-y-4" aria-label="Weekly quota exhaustion summary">
      <div className="bg-zinc-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" aria-live="polite">
        <div>
          <h4 className="text-sm font-medium text-zinc-900">Early Quota Exhaustion</h4>
          <p className="text-xs text-zinc-600 mt-0.5">
            {totalEarly} of {totalUsers} users ({totalUsers > 0 ? ((totalEarly / totalUsers) * 100).toFixed(0) : '0'}%) exhausted before day 28
          </p>
        </div>
        {totalEarly === 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Balanced usage
          </span>
        )}
      </div>

      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
            barCategoryGap={40}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
            <Tooltip
              formatter={(value: number) => [`${value}`, 'Users']}
              labelFormatter={(label, items) => {
                const row = items?.[0]?.payload as WeeklyQuotaDatum | undefined;
                return row ? `${String(label)} (${row.range})` : String(label);
              }}
              contentStyle={chartTooltipContentStyle}
              labelStyle={chartTooltipLabelStyle}
            />
            <Bar dataKey="users" fill="#dc2626" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-zinc-400">Users who exhausted quota in each week window.</p>
    </div>
  );
}