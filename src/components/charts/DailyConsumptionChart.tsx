'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DailyConsumptionDatum } from '@/utils/dailyConsumption';
import { formatCurrency } from '@/utils/formatters';

import {
  chartTooltipContentStyle,
  chartTooltipLabelStyle,
  utcDateLabelFormatter,
  utcDateTickFormatter,
} from './chartTooltipStyles';

interface DailyConsumptionChartProps {
  data: DailyConsumptionDatum[];
}

export function DailyConsumptionChart({ data }: DailyConsumptionChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={utcDateTickFormatter}
          tick={{ fontSize: 12, fill: '#636c76' }}
          axisLine={{ stroke: '#d1d9e0' }}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fontSize: 12, fill: '#636c76' }}
          axisLine={{ stroke: '#d1d9e0' }}
          width={90}
          label={{ value: 'USD', angle: -90, position: 'insideLeft', fill: '#636c76' }}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          itemSorter={(item) => item.dataKey === 'included' ? 0 : 1}
          labelFormatter={utcDateLabelFormatter}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
        />
        <Legend
          itemSorter={(item) => item.dataKey === 'included' ? 0 : 1}
          wrapperStyle={{ fontSize: 12, color: '#636c76' }}
        />
        <Bar dataKey="included" name="Included usage" stackId="consumption" fill="#2da44e" />
        <Bar dataKey="additional" name="Additional usage" stackId="consumption" fill="#cf222e" />
      </BarChart>
    </ResponsiveContainer>
  );
}
