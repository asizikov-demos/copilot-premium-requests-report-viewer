"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

export interface ModelDailyDatum {
  date: string;
  totalRequests: number;
  [model: string]: string | number;
}

type ResponsiveHeight = number | `${number}%`;

export interface ModelDailyStackedChartProps {
  data: ModelDailyDatum[];
  models: string[];
  modelColors: Record<string, string>;
  height?: ResponsiveHeight;
}

export function ModelDailyStackedChart({ data, models, modelColors, height = '100%' }: ModelDailyStackedChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          labelFormatter={(value) => value as string}
          formatter={(value, name) => [Number(value).toFixed(2), String(name)]}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#636c76' }} />
        {models.map((model) => (
          <Bar
            key={model}
            dataKey={model}
            stackId="models"
            fill={modelColors[model] ?? '#3b82f6'}
            name={model}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
