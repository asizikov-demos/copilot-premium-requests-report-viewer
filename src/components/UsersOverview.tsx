'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { UserSummary, DailyCumulativeData } from '@/utils/dataAnalysis';
import { ProcessedData } from '@/types/csv';
import { UserConsumptionModal } from './UserConsumptionModal';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';
import { PRICING } from '@/constants/pricing';

interface UsersOverviewProps {
  userData: UserSummary[];
  processedData: ProcessedData[]; // Add this for modal
  allModels: string[];
  selectedPlan: 'business' | 'enterprise';
  dailyCumulativeData: DailyCumulativeData[];
  onBack: () => void;
}

// Generate colors for user lines
const generateUserColors = (users: string[]): Record<string, string> => {
  const colors = [
    '#3B82F6', // blue-500
    '#EF4444', // red-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#8B5CF6', // violet-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
    '#F97316', // orange-500
    '#EC4899', // pink-500
    '#6366F1', // indigo-500
  ];
  
  const result: Record<string, string> = {};
  users.forEach((user, index) => {
    result[user] = colors[index % colors.length];
  });
  return result;
};

export function UsersOverview({ userData, processedData, allModels, selectedPlan, dailyCumulativeData, onBack }: UsersOverviewProps) {
  const [showChart, setShowChart] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const currentQuota = planInfo[selectedPlan].monthlyQuota;
  
  // Calculate total overage cost
  const totalOverageRequests = userData.reduce((total, user) => {
    const overage = calculateOverageRequests(user.totalRequests, currentQuota);
    return total + overage;
  }, 0);
  const totalOverageCost = calculateOverageCost(totalOverageRequests);
  
  // Handle sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // Sort userData based on current sort settings
  const sortedUserData = [...userData].sort((a, b) => {
    if (!sortBy) return 0;
    
    let aValue: number;
    let bValue: number;
    
    if (sortBy === 'totalRequests') {
      aValue = a.totalRequests;
      bValue = b.totalRequests;
    } else {
      // It's a model column
      aValue = a.modelBreakdown[sortBy] || 0;
      bValue = b.modelBreakdown[sortBy] || 0;
    }
    
    const comparison = aValue - bValue;
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  // Get users for chart
  const chartUsers = userData.map(u => u.user);
  const userColors = generateUserColors(chartUsers);

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden h-full flex flex-col">
      {/* Enhanced Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 flex-shrink-0">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">Users Overview</h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6 mt-1">
            <p className="text-sm text-gray-500">
              {planInfo[selectedPlan].name} - {currentQuota} premium requests/month
            </p>
            {totalOverageRequests > 0 && (
              <p className="text-sm text-red-600 font-medium">
                Overage cost: ${totalOverageCost.toFixed(2)} ({totalOverageRequests.toFixed(1)} requests × ${PRICING.OVERAGE_RATE_PER_REQUEST.toFixed(2)})
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Mobile Chart Toggle */}
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
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ← Back to Summary
          </button>
        </div>
      </div>
      
      {/* Conditional Chart - Collapsible on Mobile */}
      {(!isMobile || showChart) && (
        <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0 relative z-30">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">Premium Request Quota Consumption</h4>
            {isMobile && (
              <button
                onClick={() => setShowChart(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Hide chart"
              >
                ✕
              </button>
            )}
          </div>
          <div className="h-64 sm:h-80 relative z-30">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyCumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
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
                    return date.toLocaleDateString();
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)} requests`,
                    name
                  ]}
                />
                {/* Quota reference line */}
                <ReferenceLine 
                  y={currentQuota} 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: `${currentQuota} quota limit`, position: "insideTopRight" }}
                />
                {/* User lines */}
                {chartUsers.map((user) => (
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
          </div>
        </div>
      )}
      
      {/* Enhanced Table with Mobile Optimizations */}
      {(!isMobile || !showChart) && (
        <div className="flex-1 overflow-auto">
          {/* Mobile Summary Cards */}
          {isMobile && (
            <div className="p-4 space-y-3 sm:hidden">
              {sortedUserData.slice(0, 5).map((user) => (
                <button
                  key={user.user}
                  onClick={() => setSelectedUser(user.user)}
                  className="w-full bg-gray-50 rounded-lg p-4 border hover:bg-gray-100 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-blue-600 truncate flex-1 mr-2">
                      {user.user}
                    </h5>
                    <span className={`text-sm font-semibold ${
                      user.totalRequests > currentQuota ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {user.totalRequests.toFixed(1)}
                    </span>
                  </div>
                  {user.totalRequests > currentQuota && (
                    <div className="text-xs text-red-500 mb-2">
                      Exceeds quota by {(user.totalRequests - currentQuota).toFixed(1)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Top model: {Object.entries(user.modelBreakdown)
                      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'}
                  </div>
                </button>
              ))}
              
              {sortedUserData.length > 5 && (
                <button 
                  onClick={() => setShowChart(false)}
                  className="w-full text-center py-3 text-blue-600 text-sm font-medium border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  View Full Table ({sortedUserData.length - 5} more users)
                </button>
              )}
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden sm:block border-t border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0 z-30 min-w-40 border-r border-gray-200">
                  User
                </th>
                <th 
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32 cursor-pointer hover:bg-gray-100 select-none ${
                    sortBy === 'totalRequests' ? 'bg-gray-200' : 'bg-gray-50'
                  }`}
                  onClick={() => handleSort('totalRequests')}
                >
                  <div className="flex items-center justify-between">
                    Total Requests
                    <span className="ml-1">
                      {sortBy === 'totalRequests' ? (
                        sortDirection === 'desc' ? '↓' : '↑'
                      ) : '↕'}
                    </span>
                  </div>
                </th>
                {allModels.map((model) => (
                  <th
                    key={model}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32 cursor-pointer hover:bg-gray-100 select-none ${
                      sortBy === model ? 'bg-gray-200' : 'bg-gray-50'
                    }`}
                    title={model}
                    onClick={() => handleSort(model)}
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {model.length > 20 ? `${model.substring(0, 20)}...` : model}
                      </span>
                      <span className="ml-1">
                        {sortBy === model ? (
                          sortDirection === 'desc' ? '↓' : '↑'
                        ) : '↕'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedUserData.map((user, index) => (
                <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium sticky left-0 z-10 border-r border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <button
                      onClick={() => setSelectedUser(user.user)}
                      className="max-w-32 truncate text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                      title={`View ${user.user}'s consumption details`}
                    >
                      {user.user}
                    </button>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold ${
                    user.totalRequests > currentQuota 
                      ? 'text-red-600' 
                      : 'text-blue-600'
                  }`}>
                    {user.totalRequests.toFixed(2)}
                    {user.totalRequests > currentQuota && (
                      <span className="ml-2 text-xs text-red-500">
                        (Exceeds quota by {(user.totalRequests - currentQuota).toFixed(2)})
                      </span>
                    )}
                  </td>
                  {allModels.map((model) => (
                    <td
                      key={`${user.user}-${model}`}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                    >
                      {user.modelBreakdown[model]?.toFixed(2) || '0.00'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      
      {userData.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500 flex-shrink-0">
          No user data available
        </div>
      )}
      
      {/* User Consumption Modal */}
      {selectedUser && (
        <UserConsumptionModal
          user={selectedUser}
          processedData={processedData}
          selectedPlan={selectedPlan}
          currentQuota={currentQuota}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
