'use client';

import { WeeklyExhaustionData } from '@/utils/analytics/weeklyQuota';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import React, { useMemo } from 'react';

interface WeeklyQuotaExhaustionProps {
  weeklyExhaustion: WeeklyExhaustionData;
  totalUsers: number;
  height?: number | string;
}

interface WeeklyQuotaDatum {
  week: string;
  users: number;
  range: string; // days range for tooltip
}

export function WeeklyQuotaExhaustion({ weeklyExhaustion, totalUsers, height = 280 }: WeeklyQuotaExhaustionProps) {
  const { week1Exhausted, week2Exhausted, week3Exhausted } = weeklyExhaustion;
  const totalEarly = week1Exhausted.length + week2Exhausted.length + week3Exhausted.length;

  const data: WeeklyQuotaDatum[] = useMemo(() => [
    { week: 'Week 1', users: week1Exhausted.length, range: 'Days 1-7' },
    { week: 'Week 2', users: week2Exhausted.length, range: 'Days 8-14' },
    { week: 'Week 3', users: week3Exhausted.length, range: 'Days 15-21' },
  ], [week1Exhausted, week2Exhausted, week3Exhausted]);

  return (
    <div className="space-y-4" aria-label="Weekly quota exhaustion summary">
      <div className="bg-gray-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" aria-live="polite">
        <div>
          <h4 className="font-medium text-gray-900">Early Quota Exhaustion</h4>
          <p className="text-sm text-gray-600 mt-1">
            {totalEarly} of {totalUsers} users ({totalUsers > 0 ? ((totalEarly / totalUsers) * 100).toFixed(1) : '0'}) exhausted quota before day 21
          </p>
        </div>
        {totalEarly === 0 && (
          <span className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
            Balanced usage ✅
          </span>
        )}
      </div>

      <div className="w-full h-[240px]">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            barCategoryGap={50}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis allowDecimals={false} label={{ value: 'Users', angle: -90, position: 'insideLeft', dy: 35 }} />
            <Tooltip
              formatter={(value: number) => [`${value} users`, 'Users']}
              labelFormatter={(label: string, items: { payload?: WeeklyQuotaDatum }[]) => {
                const row = items?.[0]?.payload;
                return row ? `${label} (${row.range})` : label;
              }}
            />
            <Bar dataKey="users" fill="#EF4444" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500">Bars show count of users who exhausted full quota in each early-week window.</p>
    </div>
  );
}