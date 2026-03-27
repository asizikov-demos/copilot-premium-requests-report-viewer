"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getModelColor } from '@/utils/modelColors';
import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

export interface ModelRequestsBarChartDatum {
  model: string;      // shortened model label for axis
  fullModel: string;  // full model name used for tooltip, React keys, and color mapping
  requests: number;   // total requests
}


type ResponsiveHeight = number | `${number}%`;

interface ModelRequestsBarChartProps {
  data: ModelRequestsBarChartDatum[];
  height?: ResponsiveHeight;
}

// Extracted from DataAnalysis overview section to standardize chart usage
export function ModelRequestsBarChart({ data, height = '100%' as ResponsiveHeight }: ModelRequestsBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis 
          dataKey="model" 
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fill: '#636c76', fontSize: 11 }}
          axisLine={{ stroke: '#d1d9e0' }}
          tickLine={{ stroke: '#d1d9e0' }}
        />
        <YAxis 
          tick={{ fill: '#636c76', fontSize: 11 }}
          axisLine={{ stroke: '#d1d9e0' }}
          tickLine={{ stroke: '#d1d9e0' }}
        />
        <Tooltip 
          formatter={(value) => [
            `${Number(value).toLocaleString()} requests`,
            'Total Requests'
          ]}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload as ModelRequestsBarChartDatum | undefined;
            return item?.fullModel ?? (label as string);
          }}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Bar 
          dataKey="requests" 
          radius={[2, 2, 0, 0]}
          animationDuration={800}
          animationEasing="ease-out"
        >
          {data.map((entry) => (
            <Cell 
              key={entry.fullModel} 
              fill={getModelColor(entry.fullModel)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
