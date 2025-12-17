'use client';

import { useState, useMemo, useCallback } from 'react';
import { UsersQuotaConsumptionChart } from './charts/UsersQuotaConsumptionChart';
import { UsersConsumptionHeatmap } from './charts/UsersConsumptionHeatmap';
import { UserSummary } from '@/utils/analytics/powerUsers';
import { ProcessedData } from '@/types/csv';
import { UserConsumptionModal } from './UserConsumptionModal';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useUserConsumptionModal } from '@/hooks/useUserConsumptionModal';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PRICING } from '@/constants/pricing';
import { getUserQuota, QuotaArtifacts, UsageArtifacts, computeOverageSummaryFromArtifacts } from '@/utils/ingestion';

type DailyCumulativeData = { date: string; [user: string]: string | number };

interface UsersOverviewProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  allModels: string[];
  selectedPlan: 'business' | 'enterprise';
  dailyCumulativeData: DailyCumulativeData[];
  quotaArtifacts: QuotaArtifacts;
  usageArtifacts: UsageArtifacts; // NEW: used for overage + future enhancements
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

export function UsersOverview({ userData, processedData, allModels, selectedPlan, dailyCumulativeData, quotaArtifacts, usageArtifacts, onBack }: UsersOverviewProps) {
  const [showChart, setShowChart] = useState(true);
  const [chartType, setChartType] = useState<'heatmap' | 'lines'>('heatmap');
  const [currentPage, setCurrentPage] = useState(0);
  const isMobile = useIsMobile();
  const { selectedUser, open: openUserModal, close: closeUserModal, isOpen } = useUserConsumptionModal();

  const ROWS_PER_PAGE = 50;

  // Columns: quota + totalRequests + dynamic model names
  type ColumnKey = 'quota' | 'totalRequests' | typeof allModels[number];
  const columns = useMemo<ColumnKey[]>(() => ['quota', 'totalRequests', ...allModels as ColumnKey[]], [allModels]);

  const getSortableValue = useCallback((row: UserSummary, column: ColumnKey) => {
    if (column === 'quota') {
      const q = getUserQuota(quotaArtifacts, row.user);
      return q === 'unlimited' ? Number.MAX_SAFE_INTEGER : q;
    }

    if (column === 'totalRequests') return row.totalRequests;
    return row.modelBreakdown[column] || 0;
  }, [quotaArtifacts]);

  const {
    sortedData: sortedUserData,
    sortBy,
    sortDirection,
    handleSort
  } = useSortableTable({
    data: userData,
    columns,
    getSortableValue,
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
  
  // Calculate total overage directly from artifacts (O(U))
  const { totalOverageRequests, totalOverageCost } = useMemo(() => (
    computeOverageSummaryFromArtifacts(usageArtifacts, quotaArtifacts)
  ), [usageArtifacts, quotaArtifacts]);
  
  // Memoize quota types calculation for chart display - NOW using O(1) quota map!
  const quotaInfo = useMemo(() => {
    const quotaTypes = new Set<number>();
    userData.forEach(user => {
      const userQuota = getUserQuota(quotaArtifacts, user.user);
      if (userQuota !== 'unlimited') {
        quotaTypes.add(userQuota);
      }
    });
    const hasMixedQuotas = quotaTypes.size > 1;
    const hasMixedLicenses = quotaTypes.has(PRICING.BUSINESS_QUOTA) && quotaTypes.has(PRICING.ENTERPRISE_QUOTA);
    return { quotaTypes, hasMixedQuotas, hasMixedLicenses };
  }, [userData, quotaArtifacts]);

  const { quotaTypes, hasMixedQuotas, hasMixedLicenses } = quotaInfo;
  
  // Pagination calculations
  const totalPages = Math.ceil(sortedUserData.length / ROWS_PER_PAGE);
  const paginatedUserData = useMemo(() => 
    sortedUserData.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE),
    [sortedUserData, currentPage]
  );

  // Reset to first page when sorting changes
  const handleSortWithReset = (column: ColumnKey) => {
    handleSort(column);
    setCurrentPage(0);
  };
  
  // Memoize chart data to prevent recalculation on pagination/sorting
  const chartData = useMemo(() => {
    const users = userData.map(u => u.user);
    return {
      users,
      colors: generateUserColors(users)
    };
  }, [userData]);

  const { users: chartUsers, colors: userColors } = chartData;

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
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setChartType('heatmap')}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    chartType === 'heatmap'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Heatmap
                </button>
                <button
                  onClick={() => setChartType('lines')}
                  disabled={chartUsers.length > 1000}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    chartType === 'lines'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  } ${chartUsers.length > 1000 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={chartUsers.length > 1000 ? `Cannot display ${chartUsers.length} users as lines` : undefined}
                >
                  Lines
                </button>
              </div>
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
          </div>
          <div className="h-64 sm:h-80 2xl:h-96 relative z-30">
            {chartType === 'heatmap' ? (
              <UsersConsumptionHeatmap
                dailyCumulativeData={dailyCumulativeData}
                users={chartUsers}
                currentQuota={currentQuota}
                quotaTypes={quotaTypes}
                hasMixedQuotas={hasMixedQuotas}
              />
            ) : chartUsers.length > 1000 ? (
              <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-gray-200">
                <div className="text-center p-8">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Too Many Users to Display</h3>
                  <p className="text-gray-600 max-w-md">
                    The line chart cannot display more than 1,000 users ({chartUsers.length.toLocaleString()} users in dataset).
                    Please use the Heatmap view for better visualization.
                  </p>
                </div>
              </div>
            ) : (
              <UsersQuotaConsumptionChart
                dailyCumulativeData={dailyCumulativeData}
                users={chartUsers}
                userColors={userColors}
                currentQuota={currentQuota}
                quotaTypes={quotaTypes}
                hasMixedQuotas={hasMixedQuotas}
                hasMixedLicenses={hasMixedLicenses}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Enhanced Table with Mobile Optimizations */}
      {(!isMobile || !showChart) && (
        <div className="flex-1 overflow-auto">
          {/* Mobile Summary Cards */}
          {isMobile && (
            <div className="p-4 space-y-3 sm:hidden">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
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
              
              {/* Mobile Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
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
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24 cursor-pointer hover:bg-gray-100 select-none ${
                    sortBy === 'quota' ? 'bg-gray-200' : 'bg-gray-50'
                  }`}
                  onClick={() => handleSortWithReset('quota')}
                >
                  <div className="flex items-center justify-between">
                    Quota
                    <span className="ml-1">
                      {sortBy === 'quota' ? (
                        sortDirection === 'desc' ? '↓' : '↑'
                      ) : '↕'}
                    </span>
                  </div>
                </th>
                <th 
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32 cursor-pointer hover:bg-gray-100 select-none ${
                    sortBy === 'totalRequests' ? 'bg-gray-200' : 'bg-gray-50'
                  }`}
                  onClick={() => handleSortWithReset('totalRequests')}
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
                    onClick={() => handleSortWithReset(model)}
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
              {paginatedUserData.map((user, index) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const isOverQuota = userQuota !== 'unlimited' && user.totalRequests > userQuota;
                const isAtQuota = userQuota !== 'unlimited' && user.totalRequests === userQuota;
                const quotaDisplay = userQuota === 'unlimited' ? 'Unlimited' : userQuota.toString();
                
                return (
                <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium sticky left-0 z-10 border-r border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <button
                      onClick={() => openUserModal(user.user)}
                      className="max-w-32 truncate text-left text-blue-600 hover:text-blue-800 hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                      title={`View ${user.user}&apos;s consumption details`}
                    >
                      {user.user}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {quotaDisplay}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold ${
                    isOverQuota || isAtQuota
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
          
          {/* Desktop Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{currentPage * ROWS_PER_PAGE + 1}</span> to{' '}
                    <span className="font-medium">{Math.min((currentPage + 1) * ROWS_PER_PAGE, sortedUserData.length)}</span> of{' '}
                    <span className="font-medium">{sortedUserData.length}</span> users
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                      disabled={currentPage === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i;
                      } else if (currentPage < 3) {
                        pageNum = i;
                      } else if (currentPage > totalPages - 4) {
                        pageNum = totalPages - 5 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                      disabled={currentPage === totalPages - 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
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
          userQuotaValue={getUserQuota(quotaArtifacts, selectedUser)}
          onClose={closeUserModal}
        />
      )}
    </div>
  );
}
