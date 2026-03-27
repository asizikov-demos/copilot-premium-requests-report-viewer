"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

export interface CodingAgentUsageDatum {
  date: string;              // YYYY-MM-DD (UTC original date fragment)
  dailyRequests: number;     // requests that day
  cumulativeRequests: number;// cumulative total up to that day
}

type ResponsiveHeight = number | `${number}%`;

interface CodingAgentUsageChartProps {
  data: CodingAgentUsageDatum[];
  height?: ResponsiveHeight;
}

export function CodingAgentUsageChart({ data, height = '100%' }: CodingAgentUsageChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          tick={{ fill: '#636c76', fontSize: 11 }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
          }}
        />
        <YAxis tick={{ fill: '#636c76', fontSize: 11 }} />
        <Tooltip 
          labelFormatter={(label) => {
            const date = new Date(label);
            return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
          }}
          formatter={(value, name) => [
            `${Number(value).toFixed(1)} requests`,
            name === 'Daily Requests' ? 'Daily' : 'Cumulative'
          ]}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Line
          type="monotone"
          dataKey="cumulativeRequests"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Cumulative Requests"
        />
        <Line
          type="monotone"
          dataKey="dailyRequests"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Daily Requests"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
