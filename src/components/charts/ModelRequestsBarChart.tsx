"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface ModelRequestsBarChartDatum {
  model: string;      // shortened model label for axis
  fullModel?: string; // full model name for tooltip
  requests: number;   // total requests
}

interface ModelRequestsBarChartProps {
  data: ModelRequestsBarChartDatum[];
  height?: number | string;
}

// Extracted from DataAnalysis overview section to standardize chart usage
export function ModelRequestsBarChart({ data, height = '100%' }: ModelRequestsBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="model" 
          angle={-45}
            textAnchor="end"
            height={100}
            fontSize={12}
        />
        <YAxis />
        <Tooltip 
          formatter={(value: number) => [
            `${value} requests`,
            'Total Requests'
          ]}
          labelFormatter={(label: string, payload: { payload?: ModelRequestsBarChartDatum }[]) => {
            const item = payload?.[0]?.payload;
            return item?.fullModel || label;
          }}
        />
        <Bar dataKey="requests" fill="#3B82F6" />
      </BarChart>
    </ResponsiveContainer>
  );
}
