"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

export interface ModelDailyDatum {
  date: string;
  totalRequests: number;
  [model: string]: string | number;
}

export interface ModelDailyStackedChartProps {
  data: ModelDailyDatum[];
  models: string[];
  modelColors: Record<string, string>;
}

export function ModelDailyStackedChart({ data, models, modelColors }: ModelDailyStackedChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(value) => {
            const d = new Date(`${value}T00:00:00Z`);
            return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
          }}
        />
        <YAxis stroke="#6b7280" fontSize={12} />
        <Tooltip
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          labelFormatter={(value) => value as string}
          formatter={(value: number, name: string) => [value.toFixed(2), name]}
        />
        <Legend />
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
