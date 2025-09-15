'use client';

import React, { useMemo, useState } from 'react';
import { ProcessedData } from '@/types/csv';
import { UserSummary } from '@/utils/dataAnalysis';

interface InsightsProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  onBack: () => void;
}

interface UserConsumptionCategory {
  user: string;
  totalRequests: number;
  quota: number | 'unlimited';
  consumptionPercentage: number;
  category: 'power' | 'average' | 'low';
}

interface InsightsData {
  powerUsers: UserConsumptionCategory[];
  averageUsers: UserConsumptionCategory[];
  lowAdoptionUsers: UserConsumptionCategory[];
}

function categorizeUserConsumption(userData: UserSummary[], processedData: ProcessedData[]): InsightsData {
  // Create a map to get quota for each user
  const userQuotaMap = new Map<string, number | 'unlimited'>();
  
  // Get the quota for each user (use the first quota found for that user)
  processedData.forEach(row => {
    if (!userQuotaMap.has(row.user)) {
      userQuotaMap.set(row.user, row.quotaValue);
    }
  });

  const categorizedUsers: UserConsumptionCategory[] = userData.map(userSummary => {
    const quota = userQuotaMap.get(userSummary.user) || 'unlimited';
    
    let consumptionPercentage = 0;
    if (quota !== 'unlimited' && typeof quota === 'number' && quota > 0) {
      consumptionPercentage = (userSummary.totalRequests / quota) * 100;
    }

    // New bands:
    // Power: >= 90%
    // Average: 45% - <90%
    // Low: <45%
    let category: 'power' | 'average' | 'low' = 'low';
    if (consumptionPercentage >= 90) {
      category = 'power';
    } else if (consumptionPercentage >= 45) {
      category = 'average';
    }

    return {
      user: userSummary.user,
      totalRequests: userSummary.totalRequests,
      quota,
      consumptionPercentage,
      category
    };
  });

  // Sort by consumption percentage (highest first)
  categorizedUsers.sort((a, b) => b.consumptionPercentage - a.consumptionPercentage);

  return {
    powerUsers: categorizedUsers.filter(u => u.category === 'power'),
    averageUsers: categorizedUsers.filter(u => u.category === 'average'),
    lowAdoptionUsers: categorizedUsers.filter(u => u.category === 'low')
  };
}

export function Insights({ userData, processedData, onBack }: InsightsProps) {
  const [isPowerUsersExpanded, setIsPowerUsersExpanded] = useState(false);
  const [isAverageUsersExpanded, setIsAverageUsersExpanded] = useState(false);
  const [isLowAdoptionExpanded, setIsLowAdoptionExpanded] = useState(false);
  
  const insightsData = useMemo(() => 
    categorizeUserConsumption(userData, processedData),
    [userData, processedData]
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consumption Insights</h2>
          <p className="text-sm text-gray-600 mt-1">
            User consumption patterns and adoption levels
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ← Back to Overview
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">✓</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-green-800">Power Users</h3>
              <p className="text-sm text-green-600">High Usage (90%+ of quota)</p>
              <p className="text-2xl font-bold text-green-900 mt-2">
                {insightsData.powerUsers.length} users
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">~</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-yellow-800">Average Users</h3>
              <p className="text-sm text-yellow-600">Moderate Usage (45-90%)</p>
              <p className="text-2xl font-bold text-yellow-900 mt-2">
                {insightsData.averageUsers.length} users
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">!</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-red-800">Low Adoption Users</h3>
              <p className="text-sm text-red-600">Under-utilized (under 45%)</p>
              <p className="text-2xl font-bold text-red-900 mt-2">
                {insightsData.lowAdoptionUsers.length} users
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="space-y-8">
        {/* Power Users Table */}
        {insightsData.powerUsers.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <button
              onClick={() => setIsPowerUsersExpanded(!isPowerUsersExpanded)}
              className="w-full px-6 py-4 border-b border-gray-200 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Power Users - High Usage (90%+ of quota)
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isPowerUsersExpanded ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {isPowerUsersExpanded && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requests Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quota
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consumption %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {insightsData.powerUsers.map((user, index) => (
                      <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.user}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.totalRequests.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.quota === 'unlimited' ? 'Unlimited' : user.quota.toString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {user.consumptionPercentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Average Users Table */}
        {insightsData.averageUsers.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <button
              onClick={() => setIsAverageUsersExpanded(!isAverageUsersExpanded)}
              className="w-full px-6 py-4 border-b border-gray-200 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Average Users - Moderate Usage (45-90%)
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isAverageUsersExpanded ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {isAverageUsersExpanded && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requests Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quota
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consumption %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {insightsData.averageUsers.map((user, index) => (
                      <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.user}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.totalRequests.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.quota === 'unlimited' ? 'Unlimited' : user.quota.toString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {user.consumptionPercentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Low Adoption Users Table */}
        {insightsData.lowAdoptionUsers.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <button
              onClick={() => setIsLowAdoptionExpanded(!isLowAdoptionExpanded)}
              className="w-full px-6 py-4 border-b border-gray-200 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Low Adoption Users - Under-utilized (under 45%)
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isLowAdoptionExpanded ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {isLowAdoptionExpanded && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requests Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quota
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consumption %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {insightsData.lowAdoptionUsers.slice(0, 20).map((user, index) => (
                      <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.user}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.totalRequests.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.quota === 'unlimited' ? 'Unlimited' : user.quota.toString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {user.consumptionPercentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {insightsData.lowAdoptionUsers.length > 20 && (
                  <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                    Showing top 20 of {insightsData.lowAdoptionUsers.length} users
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}