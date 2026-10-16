'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { bgColor, borderColor, fgColor } from '@/constants/primerTokens';
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
        <CartesianGrid strokeDasharray="3 3" stroke={borderColor.muted} />
        <XAxis
          dataKey="date"
          tickFormatter={utcDateTickFormatter}
          tick={{ fontSize: 12, fill: fgColor.muted }}
          axisLine={{ stroke: borderColor.default }}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fontSize: 12, fill: fgColor.muted }}
          axisLine={{ stroke: borderColor.default }}
          width={90}
          label={{ value: 'USD', angle: -90, position: 'insideLeft', fill: fgColor.muted }}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          itemSorter={(item) => item.dataKey === 'included' ? 0 : 1}
          labelFormatter={utcDateLabelFormatter}
          contentStyle={chartTooltipContentStyle}
          labelStyle={chartTooltipLabelStyle}
          cursor={{ fill: bgColor.neutralMuted }}
        />
        <Legend
          itemSorter={(item) => item.dataKey === 'included' ? 0 : 1}
          wrapperStyle={{ fontSize: 12, color: fgColor.muted }}
        />
        <Bar dataKey="included" name="Included usage" stackId="consumption" fill={bgColor.successEmphasis} />
        <Bar dataKey="additional" name="Additional usage" stackId="consumption" fill={bgColor.dangerEmphasis} />
      </BarChart>
    </ResponsiveContainer>
  );
}
