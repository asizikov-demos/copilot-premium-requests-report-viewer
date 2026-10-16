'use client';

import React, { useMemo } from 'react';

import { bgColor, borderColor, dataVizScale, fgColor } from '@/constants/primerTokens';

import { utcDateTickFormatter } from './chartTooltipStyles';

export interface UsersConsumptionHeatmapProps {
  dailyCumulativeData: { date: string; [user: string]: string | number }[];
  users: string[];
  title?: string;
  valueAxisLabel?: string;
  valueUnitLabel?: string;
  formatValue?: (value: number) => string;
}

interface HeatmapCell {
  date: string;
  bin: number;
  count: number;
  percentage: number;
}

const CONSUMPTION_BINS = 20;

function calculateHeatmapData(
  dailyCumulativeData: { date: string; [user: string]: string | number }[],
  users: string[],
  maxConsumption: number
): HeatmapCell[] {
  const binSize = maxConsumption / CONSUMPTION_BINS;
  const cells: HeatmapCell[] = [];

  dailyCumulativeData.forEach((dayData) => {
    const binsCount = new Array(CONSUMPTION_BINS).fill(0);
    
    users.forEach((user) => {
      const value = dayData[user];
      if (typeof value === 'number' && value > 0) {
        const binIndex = Math.min(
          Math.floor(value / binSize),
          CONSUMPTION_BINS - 1
        );
        binsCount[binIndex]++;
      }
    });

    const totalUsers = users.length;
    binsCount.forEach((count, binIndex) => {
      cells.push({
        date: dayData.date as string,
        bin: binIndex,
        count,
        percentage: totalUsers > 0 ? (count / totalUsers) * 100 : 0
      });
    });
  });

  return cells;
}

function getHeatmapColor(percentage: number): string {
  if (percentage === 0) return bgColor.muted;
  if (percentage < 1) return dataVizScale('blue', 0);
  if (percentage < 2) return dataVizScale('blue', 0.15);
  if (percentage < 5) return dataVizScale('blue', 0.3);
  if (percentage < 10) return dataVizScale('blue', 0.45);
  if (percentage < 15) return dataVizScale('blue', 0.6);
  if (percentage < 20) return dataVizScale('blue', 0.75);
  if (percentage < 30) return dataVizScale('blue', 0.9);
  return dataVizScale('blue', 1);
}

export function UsersConsumptionHeatmap({
  dailyCumulativeData,
  users,
  title,
  valueAxisLabel = 'AI Credits Used',
  valueUnitLabel = 'AI Credits',
  formatValue = (value) => Math.round(value).toString()
}: UsersConsumptionHeatmapProps) {
  const { heatmapData, binSize } = useMemo(() => {
    let maxValue = 0;
    
    // Find max consumption without spreading thousands of values
    for (const day of dailyCumulativeData) {
      for (const user of users) {
        const val = day[user];
        if (typeof val === 'number' && val > maxValue) {
          maxValue = val;
        }
      }
    }

    // Keep a nonzero domain for reports with no consumption.
    maxValue = maxValue > 0 ? maxValue : 1;
    const data = calculateHeatmapData(dailyCumulativeData, users, maxValue);
    const calculatedBinSize = maxValue / CONSUMPTION_BINS;

    return { heatmapData: data, binSize: calculatedBinSize };
  }, [dailyCumulativeData, users]);

  const dates = useMemo(() => 
    dailyCumulativeData.map(d => d.date as string),
    [dailyCumulativeData]
  );

  const leftMargin = 80;
  const topMargin = 40;
  const bottomMargin = 80;
  const rightMargin = 20;
  
  // Use percentages to fit width, fixed height for bins
  const cellHeight = 15;
  const chartHeight = CONSUMPTION_BINS * cellHeight;
  
  const totalHeight = chartHeight + topMargin + bottomMargin;

  const formatBinLabel = (binIndex: number) => {
    const binStart = binIndex * binSize;
    const binEnd = (binIndex + 1) * binSize;
    return `${formatValue(binStart)}-${formatValue(binEnd)}`;
  };

  const dateTickIndices = useMemo(() => {
    if (dates.length === 0) return [];
    const maxTicks = 10;
    const step = Math.max(1, Math.floor(dates.length / maxTicks));
    const indices: number[] = [];
    for (let i = 0; i < dates.length; i += step) {
      indices.push(i);
    }
    if (!indices.includes(dates.length - 1)) {
      indices.push(dates.length - 1);
    }
    return indices;
  }, [dates.length]);

  const binTickIndices = useMemo(() => {
    const indices: number[] = [0];
    const step = Math.max(1, Math.floor(CONSUMPTION_BINS / 10));
    for (let i = step; i < CONSUMPTION_BINS; i += step) {
      indices.push(i);
    }
    if (!indices.includes(CONSUMPTION_BINS - 1)) {
      indices.push(CONSUMPTION_BINS - 1);
    }
    return indices;
  }, []);

  const chartLabel = title ?? `User Consumption Density Over Time (${users.length} users)`;

  return (
    <div className="w-full h-full">
      <svg
        viewBox={`0 0 1000 ${totalHeight}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={chartLabel}
      >
          {/* Title */}
          <text
            x="500"
            y="20"
            textAnchor="middle"
            className="text-sm font-medium"
            fill={fgColor.default}
          >
            {chartLabel}
          </text>

          {/* Y-axis label */}
          <text
            x={20}
            y={topMargin + chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, 20, ${topMargin + chartHeight / 2})`}
            className="text-xs font-medium"
            fill={fgColor.muted}
          >
            {valueAxisLabel}
          </text>

          {/* Heatmap cells */}
          <g transform={`translate(${leftMargin}, ${topMargin})`}>
            {heatmapData.map((cell, idx) => {
              const dateIndex = dates.indexOf(cell.date);
              const chartWidth = 1000 - leftMargin - rightMargin;
              const cellWidth = chartWidth / dates.length;
              const x = dateIndex * cellWidth;
              const y = chartHeight - (cell.bin + 1) * cellHeight;
              
              return (
                <g key={idx}>
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth}
                    height={cellHeight}
                    fill={getHeatmapColor(cell.percentage)}
                    stroke={bgColor.default}
                    strokeWidth={0.5}
                  />
                  <title>
                    {utcDateTickFormatter(cell.date)}: {formatBinLabel(cell.bin)} {valueUnitLabel}
                    {'\n'}{cell.count} users ({cell.percentage.toFixed(1)}%)
                  </title>
                </g>
              );
            })}

            {/* Y-axis ticks and labels */}
            {binTickIndices.map((binIndex) => {
              const y = chartHeight - binIndex * cellHeight;
              return (
                <g key={binIndex}>
                  <line
                    x1={-5}
                    y1={y}
                    x2={0}
                    y2={y}
                    stroke={borderColor.emphasis}
                    strokeWidth={1}
                  />
                  <text
                    x={-10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs"
                    fill={fgColor.muted}
                  >
                    {formatValue(binIndex * binSize)}
                  </text>
                </g>
              );
            })}

            {/* X-axis */}
            <line
              x1={0}
              y1={chartHeight}
              x2={1000 - leftMargin - rightMargin}
              y2={chartHeight}
              stroke={borderColor.emphasis}
              strokeWidth={1}
            />

            {/* X-axis ticks and labels */}
            {dateTickIndices.map((dateIndex) => {
              const chartWidth = 1000 - leftMargin - rightMargin;
              const cellWidth = chartWidth / dates.length;
              const x = dateIndex * cellWidth + cellWidth / 2;
              return (
                <g key={dateIndex}>
                  <line
                    x1={x}
                    y1={chartHeight}
                    x2={x}
                    y2={chartHeight + 5}
                    stroke={borderColor.emphasis}
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={chartHeight + 20}
                    textAnchor="middle"
                    className="text-xs"
                    fill={fgColor.muted}
                    transform={`rotate(-45, ${x}, ${chartHeight + 20})`}
                  >
                    {utcDateTickFormatter(dates[dateIndex])}
                  </text>
                </g>
              );
            })}

            {/* Y-axis */}
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={chartHeight}
              stroke={borderColor.emphasis}
              strokeWidth={1}
            />
          </g>

          {/* Legend */}
          <g transform={`translate(${leftMargin}, ${topMargin + chartHeight + 60})`}>
            <text x={0} y={0} className="text-xs font-medium" fill={fgColor.default}>
              User Density:
            </text>
            {[
              { label: '0%', color: getHeatmapColor(0) },
              { label: '<1%', color: getHeatmapColor(0.5) },
              { label: '1-5%', color: getHeatmapColor(2) },
              { label: '5-10%', color: getHeatmapColor(5) },
              { label: '10-20%', color: getHeatmapColor(15) },
              { label: '20-30%', color: getHeatmapColor(20) },
              { label: '>30%', color: getHeatmapColor(30) }
            ].map((item, idx) => (
              <g key={idx} transform={`translate(${idx * 85}, 10)`}>
                <rect
                  x={0}
                  y={0}
                  width={20}
                  height={12}
                  fill={item.color}
                  stroke={borderColor.default}
                  strokeWidth={1}
                />
                <text x={25} y={10} className="text-xs" fill={fgColor.muted}>
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
    </div>
  );
}
