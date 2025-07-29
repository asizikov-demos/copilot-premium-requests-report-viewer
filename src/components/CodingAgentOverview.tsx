'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CodingAgentOverviewProps } from '@/types/csv';

export function CodingAgentOverview({ 
  codingAgentUsers, 
  totalUniqueUsers,
  adoptionRate, 
  processedData,
  onBack 
}: CodingAgentOverviewProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate daily coding agent usage data
  const dailyCodingAgentData = useMemo(() => {
    const dailyData = new Map<string, number>();
    
    processedData.forEach(row => {
      const isCodingAgent = row.model.toLowerCase().includes('coding agent') || 
                           row.model.toLowerCase().includes('padawan');
      if (isCodingAgent) {
        const date = new Date(row.timestamp).toISOString().split('T')[0];
        dailyData.set(date, (dailyData.get(date) || 0) + row.requestsUsed);
      }
    });

    const sortedDates = Array.from(dailyData.keys()).sort();
    let cumulative = 0;
    
    return sortedDates.map(date => {
      const dailyRequests = dailyData.get(date) || 0;
      cumulative += dailyRequests;
      return {
        date,
        dailyRequests,
        cumulativeRequests: cumulative
      };
    });
  }, [processedData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Coding Agent Adoption</h2>
          <p className="text-sm text-gray-600 mt-1">
            {adoptionRate.toFixed(1)}% ({codingAgentUsers.length}/{totalUniqueUsers}) adoption rate
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {isMobile && (
            <button
              onClick={() => setShowChart(!showChart)}
              className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              {showChart ? '📋 Show Table' : '📈 Show Chart'}
            </button>
          )}
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Back to Summary
          </button>
        </div>
      </div>

      {/* Chart */}
      {(!isMobile || showChart) && dailyCodingAgentData.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Coding Agent Usage Over Time</h3>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyCodingAgentData}>
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
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)} requests`,
                    name === 'Daily Requests' ? 'Daily' : 'Cumulative'
                  ]}
                />
                {/* Cumulative total line */}
                <Line
                  type="monotone"
                  dataKey="cumulativeRequests"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Cumulative Requests"
                />
                {/* Daily requests line */}
                <Line
                  type="monotone"
                  dataKey="dailyRequests"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Daily Requests"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Users Table */}
      {(!isMobile || !showChart) && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Coding Agent Users</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coding Agent Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quota
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {codingAgentUsers.map((user) => (
                  <tr key={user.user} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.user}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.codingAgentRequests.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.totalRequests.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.codingAgentPercentage.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.quota === 'unlimited' ? 'Unlimited' : user.quota}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
