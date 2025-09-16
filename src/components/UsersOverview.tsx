'use client';

import { useState, useEffect, useMemo } from 'react';
import { UsersQuotaConsumptionChart } from './charts/UsersQuotaConsumptionChart';
import { UserSummary, DailyCumulativeData, getUserQuotaValue } from '@/utils/analytics';
import { ProcessedData } from '@/types/csv';
import { UserConsumptionModal } from './UserConsumptionModal';
import { calculateOverageRequests, calculateOverageCost } from '@/utils/userCalculations';
import { computeOverageSummary } from '@/utils/analytics/overage';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useUserConsumptionModal } from '@/hooks/useUserConsumptionModal';
import { useIsMobile } from '@/hooks/useIsMobile';
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
  const isMobile = useIsMobile();
  const { selectedUser, open: openUserModal, close: closeUserModal, isOpen } = useUserConsumptionModal();

  // Columns: totalRequests + dynamic model names
  type ColumnKey = 'totalRequests' | typeof allModels[number];
  const columns = useMemo<ColumnKey[]>(() => ['totalRequests', ...allModels as ColumnKey[]], [allModels]);

  const {
    sortedData: sortedUserData,
    sortBy,
    sortDirection,
    handleSort,
    isSorted
  } = useSortableTable({
    data: userData,
    columns,
    getSortableValue: (row, column) => {
      if (column === 'totalRequests') return row.totalRequests;
      return row.modelBreakdown[column] || 0;
    },
    defaultSort: { column: 'totalRequests', direction: 'desc' }
  });

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

  const currentQuota = planInfo[selectedPlan].monthlyQuota;
  
  // Calculate total overage via utility (ensures consistency & testability)
  const { totalOverageRequests, totalOverageCost } = useMemo(() => (
    computeOverageSummary(userData, processedData)
  ), [userData, processedData]);
  
  // Detect if we have mixed quota types for chart display
  const quotaTypes = new Set<number>();
  userData.forEach(user => {
    const userQuota = getUserQuotaValue(processedData, user.user);
    if (userQuota !== 'unlimited') {
      quotaTypes.add(userQuota);
    }
  });
  const hasMixedQuotas = quotaTypes.size > 1;
  const hasMixedLicenses = quotaTypes.has(PRICING.BUSINESS_QUOTA) && quotaTypes.has(PRICING.ENTERPRISE_QUOTA);
  
  // sortedUserData provided by hook
  
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
              {hasMixedLicenses ? (
                <>
                  Mixed Licenses - Business ({PRICING.BUSINESS_QUOTA}) & Enterprise ({PRICING.ENTERPRISE_QUOTA}) premium requests/month
                </>
              ) : (
                `${planInfo[selectedPlan].name} - ${currentQuota} premium requests/month`
              )}
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
          <div className="h-64 sm:h-80 2xl:h-96 relative z-30">
            <UsersQuotaConsumptionChart
              dailyCumulativeData={dailyCumulativeData}
              users={chartUsers}
              userColors={userColors}
              currentQuota={currentQuota}
              quotaTypes={quotaTypes}
              hasMixedQuotas={hasMixedQuotas}
              hasMixedLicenses={hasMixedLicenses}
            />
          </div>
        </div>
      )}
      
      {/* Enhanced Table with Mobile Optimizations */}
      {(!isMobile || !showChart) && (
        <div className="flex-1 overflow-auto">
          {/* Mobile Summary Cards */}
          {isMobile && (
            <div className="p-4 space-y-3 sm:hidden">
              {sortedUserData.slice(0, 5).map((user) => {
                const userQuota = getUserQuotaValue(processedData, user.user);
                const isOverQuota = userQuota !== 'unlimited' && user.totalRequests > userQuota;
                const quotaDisplay = userQuota === 'unlimited' ? 'Unlimited' : `${userQuota}`;
                
                return (
                <button
                  key={user.user}
                  onClick={() => openUserModal(user.user)}
                  className="w-full bg-gray-50 rounded-lg p-4 border hover:bg-gray-100 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-blue-600 truncate flex-1 mr-2">
                      {user.user}
                    </h5>
                    <span className={`text-sm font-semibold ${
                      isOverQuota ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {user.totalRequests.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    Quota: {quotaDisplay}
                  </div>
                  {isOverQuota && (
                    <div className="text-xs text-red-500 mb-2">
                      Exceeds quota by {(user.totalRequests - (userQuota as number)).toFixed(1)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Top model: {Object.entries(user.modelBreakdown)
                      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'}
                  </div>
                </button>
              )})}
              
              
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24 bg-gray-50">
                  Quota
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
              {sortedUserData.map((user, index) => {
                const userQuota = getUserQuotaValue(processedData, user.user);
                const isOverQuota = userQuota !== 'unlimited' && user.totalRequests > userQuota;
                const quotaDisplay = userQuota === 'unlimited' ? 'Unlimited' : userQuota.toString();
                
                return (
                <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium sticky left-0 z-10 border-r border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <button
                      onClick={() => openUserModal(user.user)}
                      className="max-w-32 truncate text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                      title={`View ${user.user}'s consumption details`}
                    >
                      {user.user}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {quotaDisplay}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold ${
                    isOverQuota 
                      ? 'text-red-600' 
                      : 'text-blue-600'
                  }`}>
                    {user.totalRequests.toFixed(2)}
                    {isOverQuota && (
                      <span className="ml-2 text-xs text-red-500">
                        (Exceeds quota by {(user.totalRequests - (userQuota as number)).toFixed(2)})
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
              )})}
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
      {isOpen && selectedUser && (
        <UserConsumptionModal
          user={selectedUser}
          processedData={processedData}
          userQuotaValue={getUserQuotaValue(processedData, selectedUser)}
          onClose={closeUserModal}
        />
      )}
    </div>
  );
}
