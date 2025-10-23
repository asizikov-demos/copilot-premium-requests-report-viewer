'use client';

import React, { useMemo } from 'react';
import { PRICING } from '@/constants/pricing';

export interface UsersConsumptionHeatmapProps {
  dailyCumulativeData: { date: string; [user: string]: string | number }[];
  users: string[];
  currentQuota: number;
  quotaTypes: Set<number>;
  hasMixedQuotas: boolean;
  hasMixedLicenses: boolean;
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
        percentage: (count / totalUsers) * 100
      });
    });
  });

  return cells;
}

function getHeatmapColor(percentage: number): string {
  if (percentage === 0) return '#f9fafb';
  if (percentage < 1) return '#dbeafe';
  if (percentage < 2) return '#bfdbfe';
  if (percentage < 5) return '#93c5fd';
  if (percentage < 10) return '#60a5fa';
  if (percentage < 15) return '#3b82f6';
  if (percentage < 20) return '#2563eb';
  if (percentage < 30) return '#1d4ed8';
  return '#1e40af';
}

export function UsersConsumptionHeatmap({
  dailyCumulativeData,
  users,
  currentQuota,
  quotaTypes,
  hasMixedQuotas,
  hasMixedLicenses
}: UsersConsumptionHeatmapProps) {
  const { heatmapData, maxConsumption, binSize } = useMemo(() => {
    let maxValue = currentQuota * 1.2;
    
    // Find max consumption without spreading thousands of values
    for (const day of dailyCumulativeData) {
      for (const user of users) {
        const val = day[user];
        if (typeof val === 'number' && val > maxValue) {
          maxValue = val;
        }
      }
    }

    const data = calculateHeatmapData(dailyCumulativeData, users, maxValue);
    const calculatedBinSize = maxValue / CONSUMPTION_BINS;

    return { heatmapData: data, maxConsumption: maxValue, binSize: calculatedBinSize };
  }, [dailyCumulativeData, users, currentQuota]);

  const dates = useMemo(() => 
    dailyCumulativeData.map(d => d.date as string),
    [dailyCumulativeData]
  );

  const leftMargin = 80;
  const topMargin = 40;
  const bottomMargin = 80;
  const rightMargin = 120;
  
  // Use percentages to fit width, fixed height for bins
  const cellHeight = 15;
  const chartHeight = CONSUMPTION_BINS * cellHeight;
  
  const totalHeight = chartHeight + topMargin + bottomMargin;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${month}/${day}`;
  };

  const formatBinLabel = (binIndex: number) => {
    const binStart = binIndex * binSize;
    const binEnd = (binIndex + 1) * binSize;
    if (binEnd > 1000) {
      return `${Math.round(binStart)}-${Math.round(binEnd)}`;
    }
    return `${Math.round(binStart)}-${Math.round(binEnd)}`;
  };

  const dateTickIndices = useMemo(() => {
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

  const quotaLineYPositions = useMemo(() => {
    const lines: Array<{ y: number; label: string; color: string }> = [];
    
    if (hasMixedQuotas) {
      if (quotaTypes.has(PRICING.BUSINESS_QUOTA)) {
        const binIndex = (PRICING.BUSINESS_QUOTA / maxConsumption) * CONSUMPTION_BINS;
        lines.push({
          y: chartHeight - (binIndex * cellHeight),
          label: `${PRICING.BUSINESS_QUOTA} Business`,
          color: '#f97316'
        });
      }
      if (quotaTypes.has(PRICING.ENTERPRISE_QUOTA)) {
        const binIndex = (PRICING.ENTERPRISE_QUOTA / maxConsumption) * CONSUMPTION_BINS;
        lines.push({
          y: chartHeight - (binIndex * cellHeight),
          label: `${PRICING.ENTERPRISE_QUOTA} Enterprise`,
          color: '#dc2626'
        });
      }
    } else {
      const binIndex = (currentQuota / maxConsumption) * CONSUMPTION_BINS;
      lines.push({
        y: chartHeight - (binIndex * cellHeight),
        label: `${currentQuota} quota`,
        color: '#ef4444'
      });
    }
    
    return lines;
  }, [hasMixedQuotas, quotaTypes, currentQuota, maxConsumption, chartHeight]);

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 1000 ${totalHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Title */}
          <text
            x="500"
            y="20"
            textAnchor="middle"
            className="text-sm font-medium fill-gray-700"
          >
            User Consumption Density Over Time ({users.length} users)
          </text>

          {/* Y-axis label */}
          <text
            x={20}
            y={topMargin + chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, 20, ${topMargin + chartHeight / 2})`}
            className="text-xs font-medium fill-gray-600"
          >
            Premium Requests Used
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
                    stroke="#fff"
                    strokeWidth={0.5}
                  />
                  <title>
                    {formatDate(cell.date)}: {formatBinLabel(cell.bin)} requests
                    {'\n'}{cell.count} users ({cell.percentage.toFixed(1)}%)
                  </title>
                </g>
              );
            })}

            {/* Quota reference lines */}
            {quotaLineYPositions.map((line, idx) => {
              const chartWidth = 1000 - leftMargin - rightMargin;
              return (
                <g key={idx}>
                  <line
                    x1={0}
                    y1={line.y}
                    x2={chartWidth}
                    y2={line.y}
                    stroke={line.color}
                    strokeWidth={2}
                    strokeDasharray="5,5"
                  />
                  <text
                    x={chartWidth + 5}
                    y={line.y + 4}
                    className="text-xs fill-gray-700"
                    style={{ fontSize: '11px' }}
                  >
                    {line.label}
                  </text>
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
                    stroke="#6b7280"
                    strokeWidth={1}
                  />
                  <text
                    x={-10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-gray-600"
                  >
                    {Math.round(binIndex * binSize)}
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
              stroke="#6b7280"
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
                    stroke="#6b7280"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={chartHeight + 20}
                    textAnchor="middle"
                    className="text-xs fill-gray-600"
                    transform={`rotate(-45, ${x}, ${chartHeight + 20})`}
                  >
                    {formatDate(dates[dateIndex])}
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
              stroke="#6b7280"
              strokeWidth={1}
            />
          </g>

          {/* Legend */}
          <g transform={`translate(${leftMargin}, ${topMargin + chartHeight + 60})`}>
            <text x={0} y={0} className="text-xs font-medium fill-gray-700">
              User Density:
            </text>
            {[
              { label: '0%', color: '#f9fafb' },
              { label: '<1%', color: '#dbeafe' },
              { label: '1-5%', color: '#93c5fd' },
              { label: '5-10%', color: '#60a5fa' },
              { label: '10-20%', color: '#3b82f6' },
              { label: '20-30%', color: '#1d4ed8' },
              { label: '>30%', color: '#1e40af' }
            ].map((item, idx) => (
              <g key={idx} transform={`translate(${idx * 85}, 10)`}>
                <rect
                  x={0}
                  y={0}
                  width={20}
                  height={12}
                  fill={item.color}
                  stroke="#d1d5db"
                  strokeWidth={1}
                />
                <text x={25} y={10} className="text-xs fill-gray-600">
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
    </div>
  );
}
