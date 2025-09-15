'use client';

import React, { useMemo, useState } from 'react';
import { ProcessedData } from '@/types/csv';
import { UserSummary } from '@/utils/dataAnalysis';
import { PRICING } from '@/constants/pricing';

interface InsightsOverviewProps {
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

interface InsightsOverviewData {
  powerUsers: UserConsumptionCategory[];
  averageUsers: UserConsumptionCategory[];
  lowAdoptionUsers: UserConsumptionCategory[];
}

interface FeatureUtilizationStats {
  codeReview: {
    totalSessions: number;
    averagePerUser: number;
    userCount: number;
  };
  codingAgent: {
    totalSessions: number;
    averagePerUser: number;
    userCount: number;
  };
  spark: {
    totalSessions: number;
    averagePerUser: number;
    userCount: number;
  };
}

function calculateFeatureUtilization(processedData: ProcessedData[]): FeatureUtilizationStats {
  const codeReviewUsers = new Map<string, number>();
  const codingAgentUsers = new Map<string, number>();
  const sparkUsers = new Map<string, number>();
  
  let totalCodeReviewSessions = 0;
  let totalCodingAgentSessions = 0;
  let totalSparkSessions = 0;
  
  processedData.forEach(row => {
    const modelLower = row.model.toLowerCase();
    
    if (modelLower.includes('code review')) {
      totalCodeReviewSessions += row.requestsUsed;
      const currentCount = codeReviewUsers.get(row.user) || 0;
      codeReviewUsers.set(row.user, currentCount + row.requestsUsed);
    }
    
    if (modelLower.includes('coding agent') || modelLower.includes('padawan')) {
      totalCodingAgentSessions += row.requestsUsed;
      const currentCount = codingAgentUsers.get(row.user) || 0;
      codingAgentUsers.set(row.user, currentCount + row.requestsUsed);
    }
    
    if (modelLower.includes('spark')) {
      totalSparkSessions += row.requestsUsed;
      const currentCount = sparkUsers.get(row.user) || 0;
      sparkUsers.set(row.user, currentCount + row.requestsUsed);
    }
  });
  
  const codeReviewUserCount = codeReviewUsers.size;
  const codingAgentUserCount = codingAgentUsers.size;
  const sparkUserCount = sparkUsers.size;
  
  return {
    codeReview: {
      totalSessions: totalCodeReviewSessions,
      averagePerUser: codeReviewUserCount > 0 ? totalCodeReviewSessions / codeReviewUserCount : 0,
      userCount: codeReviewUserCount
    },
    codingAgent: {
      totalSessions: totalCodingAgentSessions,
      averagePerUser: codingAgentUserCount > 0 ? totalCodingAgentSessions / codingAgentUserCount : 0,
      userCount: codingAgentUserCount
    },
    spark: {
      totalSessions: totalSparkSessions,
      averagePerUser: sparkUserCount > 0 ? totalSparkSessions / sparkUserCount : 0,
      userCount: sparkUserCount
    }
  };
}

function categorizeUserConsumption(userData: UserSummary[], processedData: ProcessedData[]): InsightsOverviewData {
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

    // Bands:
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

// Exported Overview component (renamed from `Insights` to match naming conventions)
export function InsightsOverview({ userData, processedData, onBack }: InsightsOverviewProps) {
  const [isPowerUsersExpanded, setIsPowerUsersExpanded] = useState(false);
  const [isAverageUsersExpanded, setIsAverageUsersExpanded] = useState(false);
  const [isLowAdoptionExpanded, setIsLowAdoptionExpanded] = useState(false);
  
  const insightsData = useMemo(() => 
    categorizeUserConsumption(userData, processedData),
    [userData, processedData]
  );

  const featureUtilization = useMemo(() => 
    calculateFeatureUtilization(processedData),
    [processedData]
  );

  // Compute unutilized value (only for users with numeric quotas)
  const { averageUnusedValueUSD, lowUnusedValueUSD } = useMemo(() => {
    const calcUnusedValue = (users: UserConsumptionCategory[]) => {
      let total = 0;
      for (const u of users) {
        if (typeof u.quota === 'number' && u.quota > 0) {
          const unused = Math.max(0, u.quota - u.totalRequests);
            total += unused * PRICING.OVERAGE_RATE_PER_REQUEST;
        }
      }
      return total;
    };
    return {
      averageUnusedValueUSD: calcUnusedValue(insightsData.averageUsers),
      lowUnusedValueUSD: calcUnusedValue(insightsData.lowAdoptionUsers)
    };
  }, [insightsData]);

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
          <div className="flex items-center justify-between">
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
            <div className="text-right">
              <h3 className="text-lg font-semibold text-yellow-800">Unutilized Value</h3>
              <p className="text-sm font-bold text-yellow-900">
                Total: ${averageUnusedValueUSD.toFixed(2)}
              </p>
              <p className="text-xs text-yellow-700">
                Average per user: ${insightsData.averageUsers.length > 0 ? (averageUnusedValueUSD / insightsData.averageUsers.length).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
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
            <div className="text-right">
              <h3 className="text-lg font-semibold text-red-800">Unutilized Value</h3>
              <p className="text-sm font-bold text-red-900">
                Total: ${lowUnusedValueUSD.toFixed(2)}
              </p>
              <p className="text-xs text-red-700">
                Average per user: ${insightsData.lowAdoptionUsers.length > 0 ? (lowUnusedValueUSD / insightsData.lowAdoptionUsers.length).toFixed(2) : '0.00'}
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

      {/* Feature Utilization Block */}
      <div className="bg-white shadow rounded-lg overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Feature Utilization</h3>
          <p className="text-sm text-gray-600 mt-1">
            Usage statistics for specialized Copilot features
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Code Review Sessions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-blue-800">Code Review Sessions</h4>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-blue-900">
                      {Math.round(featureUtilization.codeReview.totalSessions)} reviews
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      Average per user: {featureUtilization.codeReview.averagePerUser.toFixed(1)} reviews
                    </p>
                    <p className="text-xs text-blue-500 mt-1">
                      {featureUtilization.codeReview.userCount} users
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Copilot Coding Agent Sessions */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-purple-800">Copilot Coding Agent Sessions</h4>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-purple-900">
                      {Math.round(featureUtilization.codingAgent.totalSessions)} sessions
                    </p>
                    <p className="text-sm text-purple-600 mt-1">
                      Average per user: {featureUtilization.codingAgent.averagePerUser.toFixed(1)} sessions
                    </p>
                    <p className="text-xs text-purple-500 mt-1">
                      {featureUtilization.codingAgent.userCount} users
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Spark Sessions */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-orange-800">Spark Sessions</h4>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-orange-900">
                      {Math.round(featureUtilization.spark.totalSessions)} sessions
                    </p>
                    <p className="text-sm text-orange-600 mt-1">
                      Average per user: {featureUtilization.spark.averagePerUser.toFixed(1)} sessions
                    </p>
                    <p className="text-xs text-orange-500 mt-1">
                      {featureUtilization.spark.userCount} users
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
