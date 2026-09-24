"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { chartTooltipContentStyle, chartTooltipLabelStyle, utcDateLabelFormatter, utcDateTickFormatter } from './chartTooltipStyles';

export interface CodingAgentUsageDatum {
  date: string;              // YYYY-MM-DD (UTC original date fragment)
  dailyCredits: number;     // usage that day
  cumulativeCredits: number;// cumulative total up to that day
}

type ResponsiveHeight = number | `${number}%`;

interface CodingAgentUsageChartProps {
  data: CodingAgentUsageDatum[];
  height?: ResponsiveHeight;
  valueUnitLabel?: string;
}

export function CodingAgentUsageChart({ data, height = '100%', valueUnitLabel = 'AI Credits' }: CodingAgentUsageChartProps) {
  const dailyLabel = 'Daily AI Credits';
  const cumulativeLabel = 'Cumulative AI Credits';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          tick={{ fill: '#636c76', fontSize: 11 }}
          tickFormatter={utcDateTickFormatter}
        />
        <YAxis tick={{ fill: '#636c76', fontSize: 11 }} />
        <Tooltip 
          labelFormatter={utcDateLabelFormatter}
          formatter={(value, name) => [
            `${Number(value).toFixed(1)} ${valueUnitLabel}`,
            name === dailyLabel ? 'Daily' : 'Cumulative'
          ]}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Line
          type="monotone"
          dataKey="cumulativeCredits"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name={cumulativeLabel}
        />
        <Line
          type="monotone"
          dataKey="dailyCredits"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name={dailyLabel}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
