'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CSVData } from '@/types/csv';
import { processCSVData, analyzeData, analyzeUserData } from '@/utils/dataAnalysis';
import { UsersOverview } from './UsersOverview';

interface DataAnalysisProps {
  csvData: CSVData[];
  onReset: () => void;
}

type CopilotPlan = 'business' | 'enterprise';

export function DataAnalysis({ csvData, onReset }: DataAnalysisProps) {
  const [selectedPlan, setSelectedPlan] = useState<CopilotPlan>('business');
  const [showUsersOverview, setShowUsersOverview] = useState(false);
  
  const { analysis, userData, allModels } = useMemo(() => {
    const processedData = processCSVData(csvData);
    const analysis = analyzeData(processedData);
    const userData = analyzeUserData(processedData);
    const allModels = Array.from(new Set(processedData.map(d => d.model))).sort();
    
    return { analysis, userData, allModels };
  }, [csvData]);

  const chartData = analysis.requestsByModel.map(item => ({
    model: item.model.length > 20 ? `${item.model.substring(0, 20)}...` : item.model,
    fullModel: item.model,
    requests: Math.round(item.totalRequests * 100) / 100
  }));

  const planInfo = {
    business: {
      name: 'Copilot Business',
      monthlyQuota: 300
    },
    enterprise: {
      name: 'Copilot Enterprise', 
      monthlyQuota: 1000
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Data Analysis Results</h2>
        <button
          onClick={onReset}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Upload New File
        </button>
      </div>

      {/* Main Layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-4 gap-8 ${showUsersOverview ? 'min-h-0' : ''}`}>
        {/* Main Content Area */}
        <div className={`lg:col-span-3 space-y-8 ${showUsersOverview ? 'min-h-0' : ''}`}>
          {showUsersOverview ? (
            <div className="h-[calc(100vh-16rem)]">
              <UsersOverview 
                userData={userData}
                allModels={allModels}
                selectedPlan={selectedPlan}
                onBack={() => setShowUsersOverview(false)}
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Time Frame</dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {analysis.timeFrame.start} to {analysis.timeFrame.end}
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

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Users Exceeding Quota</dt>
                          <dd className="text-lg font-medium text-gray-900">{analysis.usersExceedingQuota}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Total Requests by Model</h3>
                <div className="h-96">
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

        {/* Information Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6 sticky top-6">
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

            {/* Information Block */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Information</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Monthly Quota:</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {planInfo[selectedPlan].monthlyQuota} premium requests
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
