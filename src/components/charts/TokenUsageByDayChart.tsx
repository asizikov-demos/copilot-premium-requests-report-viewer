'use client';

import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { chartTooltipContentStyle, chartTooltipLabelStyle, utcDateTickFormatter } from './chartTooltipStyles';
import { TOKEN_TYPE_SERIES, type TokenTypeKey } from './tokenUsageChartSeries';

export interface TokenUsageByDayChartDatum {
  date: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface TokenUsageByDayChartProps {
  data: TokenUsageByDayChartDatum[];
}

function formatTokenValue(value: unknown): string {
  return Number(value).toLocaleString();
}

export function TokenUsageByDayChart({ data }: TokenUsageByDayChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 16, right: 24, left: 12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#636c76' }}
          axisLine={{ stroke: '#d1d9e0' }}
          tickLine={{ stroke: '#d1d9e0' }}
          tickFormatter={utcDateTickFormatter}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#636c76' }}
          axisLine={{ stroke: '#d1d9e0' }}
          tickLine={{ stroke: '#d1d9e0' }}
        />
        <Tooltip
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          labelFormatter={(value) => String(value)}
          formatter={(value, name) => [formatTokenValue(value), String(name)]}
          wrapperStyle={{ zIndex: 1000 }}
          cursor={{ stroke: '#6366f1', strokeDasharray: '3 3' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#636c76' }} />
        {TOKEN_TYPE_SERIES.map((series) => (
          <Line
            key={series.key}
            type="monotone"
            dataKey={series.key as TokenTypeKey}
            name={series.label}
            stroke={series.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
