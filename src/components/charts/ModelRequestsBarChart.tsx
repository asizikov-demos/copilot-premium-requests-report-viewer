"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getModelColor } from '@/utils/modelColors';
import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

export interface ModelRequestsBarChartDatum {
  model: string;      // shortened model label for axis
  fullModel?: string; // full model name for tooltip
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
        <defs>
          {data.map((entry) => {
            const color = getModelColor(entry.fullModel || entry.model);
            return (
              <linearGradient key={entry.model} id={`gradient-${entry.model.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={0.6} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis 
          dataKey="model" 
          angle={-45}
          textAnchor="end"
          height={100}
          fontSize={11}
          tick={{ fill: '#78716c' }}
          axisLine={{ stroke: '#d6d3d1' }}
          tickLine={{ stroke: '#d6d3d1' }}
        />
        <YAxis 
          tick={{ fill: '#78716c', fontSize: 11 }}
          axisLine={{ stroke: '#d6d3d1' }}
          tickLine={{ stroke: '#d6d3d1' }}
        />
        <Tooltip 
          formatter={(value) => [
            `${Number(value).toLocaleString()} requests`,
            'Total Requests'
          ]}
          labelFormatter={(label, payload) => {
            const item = payload?.[0]?.payload as ModelRequestsBarChartDatum | undefined;
            return item?.fullModel || (label as string);
          }}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          cursor={{ fill: 'rgba(249, 115, 22, 0.05)' }}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Bar 
          dataKey="requests" 
          radius={[4, 4, 0, 0]}
          animationDuration={800}
          animationEasing="ease-out"
        >
          {data.map((entry) => (
            <Cell 
              key={entry.model} 
              fill={`url(#gradient-${entry.model.replace(/\s+/g, '-')})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
