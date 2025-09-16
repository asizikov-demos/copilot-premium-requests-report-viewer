"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PRICING } from '@/constants/pricing';

export interface UsersQuotaConsumptionChartProps {
  dailyCumulativeData: any[]; // shape: [{ date: string, [username]: number, ... }]
  users: string[];
  userColors: Record<string, string>;
  currentQuota: number; // selected plan quota (may not be used if mixed quotas)
  quotaTypes: Set<number>;
  hasMixedQuotas: boolean;
  hasMixedLicenses: boolean;
}

// Dedicated chart component extracted from UsersOverview for clarity & reuse
export function UsersQuotaConsumptionChart({
  dailyCumulativeData,
  users,
  userColors,
  currentQuota,
  quotaTypes,
  hasMixedQuotas,
  hasMixedLicenses
}: UsersQuotaConsumptionChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={dailyCumulativeData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="date" 
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
          }}
        />
        <YAxis 
          stroke="#6b7280" 
          fontSize={12}
          domain={[0, (dataMax: number) => Math.max(currentQuota, dataMax)]}
        />
        <Tooltip 
          labelFormatter={(label) => {
            const date = new Date(label);
            return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
          }}
          formatter={(value: number, name: string) => [
            `${value.toFixed(1)} requests`,
            name
          ]}
        />
        {/* Quota reference lines */}
        {hasMixedQuotas ? (
          <>
            {quotaTypes.has(PRICING.BUSINESS_QUOTA) && (
              <ReferenceLine 
                y={PRICING.BUSINESS_QUOTA} 
                stroke="#f97316" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `${PRICING.BUSINESS_QUOTA} Business quota`, position: "insideTopRight" }}
              />
            )}
            {quotaTypes.has(PRICING.ENTERPRISE_QUOTA) && (
              <ReferenceLine 
                y={PRICING.ENTERPRISE_QUOTA} 
                stroke="#dc2626" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `${PRICING.ENTERPRISE_QUOTA} Enterprise quota`, position: "insideTopRight" }}
              />
            )}
          </>
        ) : (
          <ReferenceLine 
            y={currentQuota} 
            stroke="#ef4444" 
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ value: `${currentQuota} quota limit`, position: "insideTopRight" }}
          />
        )}
        {/* User lines */}
        {users.map((user) => (
          <Line
            key={user}
            type="monotone"
            dataKey={user}
            stroke={userColors[user]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
