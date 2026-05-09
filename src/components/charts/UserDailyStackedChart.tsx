"use client";

import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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
  quotaValue: number | 'unknown';
  tooltip: React.ReactElement; // preconfigured tooltip component instance
  height?: ResponsiveHeight;
}


export function UserDailyStackedChart({ data, models, modelColors, quotaValue, tooltip, height = '100%' }: UserDailyStackedChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          tick={{ fill: '#636c76', fontSize: 11 }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
          }}
        />
        <YAxis 
          tick={{ fill: '#636c76', fontSize: 11 }}
          domain={[0, (dataMax: number) => {
            const quotaLimit = quotaValue === 'unknown' ? 0 : quotaValue;
            return Math.max(quotaLimit, dataMax);
          }]}
        />
  <Tooltip content={tooltip} />
        {quotaValue !== 'unknown' && (
          <ReferenceLine 
            y={quotaValue} 
            stroke="#ef4444" 
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ 
              value: `${quotaValue} quota limit`, 
              position: "insideTopRight",
              style: { fontSize: '12px', fill: '#ef4444' }
            }}
          />
        )}
        {models.map((model) => (
          <Bar
            key={model}
            dataKey={model}
            stackId="models"
            fill={modelColors[model]}
            name={model}
          />
        ))}
        <Line
          type="monotone"
          dataKey="totalCumulative"
          stroke="#1f2328"
          strokeWidth={3}
          dot={{ fill: '#1f2328', r: 4 }}
          activeDot={{ r: 6 }}
          name="Cumulative Total"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
