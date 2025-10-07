"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

export interface CodingAgentUsageDatum {
  date: string;              // YYYY-MM-DD (UTC original date fragment)
  dailyRequests: number;     // requests that day
  cumulativeRequests: number;// cumulative total up to that day
}

interface CodingAgentUsageChartProps {
  data: CodingAgentUsageDatum[];
}

export function CodingAgentUsageChart({ data }: CodingAgentUsageChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="date" 
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
          }}
        />
        <YAxis stroke="#6b7280" fontSize={12} />
        <Tooltip 
          labelFormatter={(label) => {
            const date = new Date(label);
            return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
          }}
          formatter={(value: number, name: string) => [
            `${value.toFixed(1)} requests`,
            name === 'Daily Requests' ? 'Daily' : 'Cumulative'
          ]}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
        />
        <Line
          type="monotone"
          dataKey="cumulativeRequests"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Cumulative Requests"
        />
        <Line
          type="monotone"
          dataKey="dailyRequests"
          stroke="#10B981"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Daily Requests"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
