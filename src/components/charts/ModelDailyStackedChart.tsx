"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

import { borderColor, dataVizColor, fgColor } from '@/constants/primerTokens';

import { chartTooltipContentStyle, chartTooltipLabelStyle, utcDateTickFormatter } from './chartTooltipStyles';

export interface ModelDailyDatum {
  date: string;
  totalCredits: number;
  [model: string]: string | number;
}

type ResponsiveHeight = number | `${number}%`;

export interface ModelDailyStackedChartProps {
  data: ModelDailyDatum[];
  models: string[];
  modelColors: Record<string, string>;
  height?: ResponsiveHeight;
  valueUnitLabel?: string;
}

export function ModelDailyStackedChart({
  data,
  models,
  modelColors,
  height = '100%',
  valueUnitLabel,
}: ModelDailyStackedChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={borderColor.muted} />
        <XAxis
          dataKey="date"
          tick={{ fill: fgColor.muted, fontSize: 12 }}
          tickFormatter={utcDateTickFormatter}
        />
        <YAxis tick={{ fill: fgColor.muted, fontSize: 12 }} />
        <Tooltip
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          labelFormatter={(value) => value as string}
          formatter={(value, name) => [
            valueUnitLabel ? `${Number(value).toFixed(2)} ${valueUnitLabel}` : Number(value).toFixed(2),
            String(name),
          ]}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: fgColor.muted }} />
        {models.map((model) => (
          <Bar
            key={model}
            dataKey={model}
            stackId="models"
            fill={modelColors[model] ?? dataVizColor('blue')}
            name={model}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
