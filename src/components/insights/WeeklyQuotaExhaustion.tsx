'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from '../charts/chartTooltipStyles';

type ResponsiveHeight = number | `${number}%`;

interface WeeklyQuotaExhaustionProps {
  weeklyExhaustion: WeeklyQuotaExhaustionBreakdown;
  totalUsers: number;
  height?: ResponsiveHeight;
}

interface WeeklyQuotaDatum {
  week: string;
  users: number;
  range: string;
}

function getFallbackRange(weekNumber: number): string {
  if (weekNumber === 1) return 'Days 1-7';
  if (weekNumber === 2) return 'Days 8-14';
  if (weekNumber === 3) return 'Days 15-21';
  if (weekNumber === 4) return 'Days 22-28';
  return 'Days 29+';
}

function formatWeekRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return '';
  // Week dates come from UTC date keys in YYYY-MM-DD format.
  const startDay = startDate.split('-')[2];
  const endDay = endDate.split('-')[2];
  return `Days ${parseInt(startDay, 10)}-${parseInt(endDay, 10)}`;
}

export function WeeklyQuotaExhaustion({ weeklyExhaustion, totalUsers, height = 280 }: WeeklyQuotaExhaustionProps) {
  const totalEarly = useMemo(() => (
    weeklyExhaustion.weeks.reduce((total, week) => (
      week.weekNumber <= 4 ? total + week.usersExhaustedInWeek : total
    ), 0)
  ), [weeklyExhaustion]);

  const data: WeeklyQuotaDatum[] = useMemo(() => {
    const weekMap = new Map(weeklyExhaustion.weeks.map((week) => [week.weekNumber, week]));
    const maxWeekNumber = Math.max(4, ...weeklyExhaustion.weeks.map((week) => week.weekNumber));

    return Array.from({ length: maxWeekNumber }, (_, index) => {
      const weekNumber = index + 1;
      const week = weekMap.get(weekNumber);

      return {
        week: `Week ${weekNumber}`,
        users: week?.usersExhaustedInWeek ?? 0,
        range: formatWeekRange(week?.startDate, week?.endDate) || getFallbackRange(weekNumber)
      };
    });
  }, [weeklyExhaustion]);

  return (
    <div className="space-y-4" aria-label="Weekly quota exhaustion summary">
      <div className="bg-[#f6f8fa] rounded-md p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" aria-live="polite">
        <div>
          <h4 className="text-sm font-medium text-[#1f2328]">Early Quota Exhaustion</h4>
          <p className="text-xs text-[#636c76] mt-0.5">
            {totalEarly} of {totalUsers} users ({totalUsers > 0 ? ((totalEarly / totalUsers) * 100).toFixed(0) : '0'}%) exhausted before day 28
          </p>
        </div>
        {totalEarly === 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#f0fdf4] text-[#2da44e] border border-[#bbf7d0]">
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
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d9e0" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
            <Tooltip
              formatter={(value) => [`${value}`, 'Users']}
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
      <p className="text-xs text-[#636c76]">Users who exhausted quota in each available week window.</p>
    </div>
  );
}
