"use client";

import React from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { borderColor, fgColor } from '@/constants/primerTokens';

import { utcDateTickFormatter } from './chartTooltipStyles';

export interface UserDailyDatum {
  date: string;
  totalCumulative: number;
  // Additional dynamic model keys mapping to numeric daily counts
  [model: string]: string | number;
}

type ResponsiveHeight = number | `${number}%`;

export interface UserDailyStackedChartProps {
  data: UserDailyDatum[]; // dynamic model columns + totalCumulative
  models: string[];
  modelColors: Record<string, string>;
  tooltip: React.ReactElement; // preconfigured tooltip component instance
  height?: ResponsiveHeight;
}


export function UserDailyStackedChart({ data, models, modelColors, tooltip, height = '100%' }: UserDailyStackedChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={borderColor.muted} />
        <XAxis 
          dataKey="date" 
          tick={{ fill: fgColor.muted, fontSize: 12 }}
          tickFormatter={utcDateTickFormatter}
        />
        <YAxis 
          tick={{ fill: fgColor.muted, fontSize: 12 }}
          domain={[0, 'dataMax']}
        />
  <Tooltip content={tooltip} />
        {models.map((model) => (
          <Bar
            key={model}
            dataKey={model}
            stackId="models"
            fill={modelColors[model]}
            name={model}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
