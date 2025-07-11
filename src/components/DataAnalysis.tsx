'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CSVData } from '@/types/csv';
import { processCSVData, analyzeData, analyzeUserData, generateDailyCumulativeData, analyzePowerUsers, containsJune2025Data, filterEarlyJune2025, getAvailableMonths, hasMultipleMonths, filterBySelectedMonths } from '@/utils/dataAnalysis';
import { UsersOverview } from './UsersOverview';
import { PowerUsersOverview } from './PowerUsersOverview';
import { PRICING } from '@/constants/pricing';

// Constants
const DEFAULT_MIN_REQUESTS = 20;

interface DataAnalysisProps {
  csvData: CSVData[];
  filename: string;
  onReset: () => void;
}

type CopilotPlan = 'business' | 'enterprise';

export function DataAnalysis({ csvData, filename, onReset }: DataAnalysisProps) {
  const [selectedPlan, setSelectedPlan] = useState<CopilotPlan>('business');
  const [showUsersOverview, setShowUsersOverview] = useState(false);
  const [showPowerUsers, setShowPowerUsers] = useState(false);
  const [minRequestsThreshold, setMinRequestsThreshold] = useState(DEFAULT_MIN_REQUESTS);
  const [excludeEarlyJune, setExcludeEarlyJune] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  
  const { analysis, userData, allModels, dailyCumulativeData, powerUsersAnalysis, processedData, hasJune2025Data, availableMonths, hasMultipleMonthsData } = useMemo(() => {
    const processedData = processCSVData(csvData);
    const hasJune2025Data = containsJune2025Data(processedData);
    const availableMonths = getAvailableMonths(processedData);
    const hasMultipleMonthsData = hasMultipleMonths(processedData);
    
    // Apply early June filter if enabled
    let filteredData = excludeEarlyJune ? filterEarlyJune2025(processedData) : processedData;
    
    // Apply billing period filter if months are selected
    filteredData = filterBySelectedMonths(filteredData, selectedMonths);
    
    const analysis = analyzeData(filteredData);
    const userData = analyzeUserData(filteredData);
    const allModels = Array.from(new Set(filteredData.map(d => d.model))).sort();
    const dailyCumulativeData = generateDailyCumulativeData(filteredData);
    const powerUsersAnalysis = analyzePowerUsers(filteredData, minRequestsThreshold);
    
    return { analysis, userData, allModels, dailyCumulativeData, powerUsersAnalysis, processedData: filteredData, hasJune2025Data, availableMonths, hasMultipleMonthsData };
  }, [csvData, minRequestsThreshold, excludeEarlyJune, selectedMonths]);

  // Auto-select plan based on quota analysis
  useEffect(() => {
    if (analysis.quotaBreakdown.suggestedPlan) {
      setSelectedPlan(analysis.quotaBreakdown.suggestedPlan);
    }
  }, [analysis.quotaBreakdown.suggestedPlan]);

  const chartData = analysis.requestsByModel.map(item => ({
    model: item.model.length > 20 ? `${item.model.substring(0, 20)}...` : item.model,
    fullModel: item.model,
    requests: Math.round(item.totalRequests * 100) / 100
  }));

  const planInfo = {
    business: {
      name: 'Copilot Business',
      monthlyQuota: PRICING.BUSINESS_QUOTA
    },
    enterprise: {
      name: 'Copilot Enterprise', 
      monthlyQuota: PRICING.ENTERPRISE_QUOTA
    }
  };

  return (
    <div className="w-full mx-auto">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Data Analysis Results</h2>
        <button
          onClick={onReset}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Upload New File
        </button>
      </div>

      {/* Mobile Navigation Pills */}
      <div className="lg:hidden mb-6">
        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg">
          <button
            onClick={() => {
              setShowUsersOverview(false);
              setShowPowerUsers(false);
            }}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              !showUsersOverview && !showPowerUsers
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => {
              setShowUsersOverview(true);
              setShowPowerUsers(false);
            }}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              showUsersOverview && !showPowerUsers
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            👥 Users ({analysis.totalUniqueUsers})
          </button>
          <button
            onClick={() => {
              setShowUsersOverview(false);
              setShowPowerUsers(true);
            }}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              showPowerUsers
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            ⭐ Power Users ({powerUsersAnalysis.powerUsers.length})
          </button>
        </div>
      </div>

      {/* Responsive Layout */}
      <div className={`${
        showUsersOverview || showPowerUsers
          ? 'block' // Full width for users table
          : 'grid grid-cols-1 xl:grid-cols-4 2xl:grid-cols-5 gap-8'
      }`}>
        {/* Main Content */}
        <div className={`${
          showUsersOverview || showPowerUsers
            ? 'w-full' 
            : 'xl:col-span-3 2xl:col-span-4 space-y-8'
        }`}>
          {showUsersOverview ? (
            <div className="min-h-[80vh]">
              <UsersOverview 
                userData={userData}
                processedData={processedData}
                allModels={allModels}
                selectedPlan={selectedPlan}
                dailyCumulativeData={dailyCumulativeData}
                onBack={() => setShowUsersOverview(false)}
              />
            </div>
          ) : showPowerUsers ? (
            <div className="min-h-[80vh]">
              <PowerUsersOverview 
                powerUsers={powerUsersAnalysis.powerUsers}
                totalQualifiedUsers={powerUsersAnalysis.totalQualifiedUsers}
                minRequestsThreshold={minRequestsThreshold}
                onBack={() => setShowPowerUsers(false)}
                onThresholdChange={setMinRequestsThreshold}
              />
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">File Info</dt>
                          <dd className="text-sm text-gray-600">
                            {analysis.timeFrame.start} to {analysis.timeFrame.end}
                          </dd>
                          <dd className="mt-1 text-sm text-gray-600 truncate" title={filename}>
                            {filename}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowUsersOverview(true)}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200 w-full text-left"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Unique Users</dt>
                          <dd className="text-lg font-medium text-gray-900">{analysis.totalUniqueUsers}</dd>
                        </dl>
                      </div>
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setShowPowerUsers(true)}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200 w-full text-left"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Power Users</dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {powerUsersAnalysis.powerUsers.length} / {powerUsersAnalysis.totalQualifiedUsers}
                          </dd>
                          <dd className="text-xs text-gray-500">
                            Top users with diverse usage
                          </dd>
                        </dl>
                      </div>
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Chart */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Total Requests by Model</h3>
                <div className="h-96 2xl:h-[32rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 60,
                      }}
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
                        formatter={(value) => [
                          `${value} requests`,
                          'Total Requests'
                        ]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item?.fullModel || label;
                        }}
                      />
                      <Bar dataKey="requests" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Requests by Model (Detailed)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Model
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Requests
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analysis.requestsByModel.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.model}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.totalRequests.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
            )}
        </div>

        {/* Info Panel - Hidden on mobile when showing users */}
        {!showUsersOverview && !showPowerUsers && (
          <div className="xl:col-span-1 2xl:col-span-1">
            <div className="bg-white shadow rounded-lg p-4 sm:p-6 sticky top-6">
              {/* Plan Selector */}
              <div className="mb-6">
                <label htmlFor="plan-selector" className="block text-sm font-medium text-gray-700 mb-2">
                  Plan Type
                </label>
                <select
                  id="plan-selector"
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value as CopilotPlan)}
                  className="block w-full pl-3 pr-10 py-2 text-base text-black border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="business">Copilot Business</option>
                  <option value="enterprise">Copilot Enterprise</option>
                </select>
              </div>

              {/* Date Filter */}
              {hasJune2025Data && (
                <div className="mb-6">
                  <div className="flex items-center">
                    <input
                      id="exclude-early-june"
                      type="checkbox"
                      checked={excludeEarlyJune}
                      onChange={(e) => setExcludeEarlyJune(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="exclude-early-june" className="ml-2 block text-sm text-gray-700">
                      Exclude data before 19th of June
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Filters out requests from June 1-18, 2025. These requests were not billable.
                  </p>
                </div>
              )}

              {/* Billing Period Filter */}
              {hasMultipleMonthsData && (
                <div className="mb-6">
                  <label htmlFor="billing-period" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Billing Period
                  </label>
                  <select
                    id="billing-period"
                    multiple
                    value={selectedMonths}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedMonths(selected);
                    }}
                    className="block w-full pl-3 pr-10 py-2 text-base text-black border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    size={Math.min(availableMonths.length, 4)}
                  >
                    {availableMonths.map(month => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Hold Ctrl/Cmd to select multiple months. Leave empty to show all months.
                  </p>
                </div>
              )}

              {/* Information Block */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Information</h3>
                <div className="space-y-4">
                  {/* Quota Breakdown */}
                  {analysis.quotaBreakdown.mixed && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <h4 className="text-sm font-medium text-amber-800 mb-2">Mixed License Types Detected</h4>
                      <div className="text-xs text-amber-700 space-y-1">
                        {analysis.quotaBreakdown.business.length > 0 && (
                          <div>• Business ({PRICING.BUSINESS_QUOTA}): {analysis.quotaBreakdown.business.length} users</div>
                        )}
                        {analysis.quotaBreakdown.enterprise.length > 0 && (
                          <div>• Enterprise ({PRICING.ENTERPRISE_QUOTA}): {analysis.quotaBreakdown.enterprise.length} users</div>
                        )}
                        {analysis.quotaBreakdown.unlimited.length > 0 && (
                          <div>• Unlimited: {analysis.quotaBreakdown.unlimited.length} users</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Monthly Quota:</span>
                    <span className="text-sm font-semibold text-blue-600">
                      {analysis.quotaBreakdown.mixed 
                        ? `Mixed (${planInfo[selectedPlan].monthlyQuota} selected)`
                        : `${planInfo[selectedPlan].monthlyQuota} premium requests`
                      }
                    </span>
                  </div>
                  
                  {analysis.quotaBreakdown.suggestedPlan && !analysis.quotaBreakdown.mixed && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs text-blue-700">
                        💡 Auto-selected {planInfo[analysis.quotaBreakdown.suggestedPlan].name} based on CSV quota data
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
