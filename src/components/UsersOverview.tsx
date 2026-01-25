'use client';

import { useState, useMemo, useCallback } from 'react';
import { UsersQuotaConsumptionChart } from './charts/UsersQuotaConsumptionChart';
import { UsersConsumptionHeatmap } from './charts/UsersConsumptionHeatmap';
import { ProcessedData } from '@/types/csv';
import { UserConsumptionModal } from './UserConsumptionModal';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useUserConsumptionModal } from '@/hooks/useUserConsumptionModal';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PRICING } from '@/constants/pricing';
import { getUserQuota, QuotaArtifacts, UsageArtifacts, computeOverageSummaryFromArtifacts } from '@/utils/ingestion';

type UserSummary = { user: string; totalRequests: number; modelBreakdown: Record<string, number>; };
type DailyCumulativeData = { date: string; [user: string]: string | number };

interface UsersOverviewProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  allModels: string[];
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

export function UsersOverview({ userData, processedData, allModels, dailyCumulativeData, quotaArtifacts, usageArtifacts, onBack }: UsersOverviewProps) {
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
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden h-full flex flex-col">
      {/* Enhanced Header */}
      <div className="px-5 py-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 flex-shrink-0">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900">Users Overview</h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mt-1">
            <p className="text-sm text-zinc-500">
              {hasMixedLicenses ? (
                <>Business ({PRICING.BUSINESS_QUOTA}) & Enterprise ({PRICING.ENTERPRISE_QUOTA})</>
              ) : (
                <>{planInfo[selectedPlan].name} — {currentQuota} requests/mo</>
              )}
            </p>
            {totalOverageRequests > 0 && (
              <p className="text-sm font-medium text-red-600">
                Overage: ${totalOverageCost.toFixed(2)}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {isMobile && (
            <button
              onClick={() => setShowChart(!showChart)}
              className="px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              {showChart ? 'Show Table' : 'Show Chart'}
            </button>
          )}
          
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
        </div>
      </div>
      
      {/* Conditional Chart - Collapsible on Mobile */}
      {(!isMobile || showChart) && (
        <div className="px-5 py-4 bg-zinc-50/50 border-b border-zinc-100 flex-shrink-0 relative z-30">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-medium text-zinc-900">Quota Consumption</h4>
            <div className="flex items-center gap-3">
              <div className="flex bg-white border border-zinc-200 rounded-lg p-0.5">
                <button
                  onClick={() => setChartType('heatmap')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    chartType === 'heatmap'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Heatmap
                </button>
                <button
                  onClick={() => setChartType('lines')}
                  disabled={chartUsers.length > 1000}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    chartType === 'lines'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:text-zinc-900'
                  } ${chartUsers.length > 1000 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={chartUsers.length > 1000 ? `Cannot display ${chartUsers.length} users` : undefined}
                >
                  Lines
                </button>
              </div>
              {isMobile && (
                <button
                  onClick={() => setShowChart(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                  aria-label="Hide chart"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="h-56 sm:h-72 2xl:h-80 relative z-30">
            {chartType === 'heatmap' ? (
              <UsersConsumptionHeatmap
                dailyCumulativeData={dailyCumulativeData}
                users={chartUsers}
                currentQuota={currentQuota}
                quotaTypes={quotaTypes}
                hasMixedQuotas={hasMixedQuotas}
              />
            ) : chartUsers.length > 1000 ? (
              <div className="flex items-center justify-center h-full bg-zinc-50 rounded-lg">
                <div className="text-center p-6">
                  <p className="text-sm font-medium text-zinc-900 mb-1">Too many users</p>
                  <p className="text-xs text-zinc-500">
                    Use heatmap for {chartUsers.length.toLocaleString()} users
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
            <div className="p-4 space-y-2 sm:hidden">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const isOverQuota = userQuota !== 'unlimited' && user.totalRequests > userQuota;
                const quotaDisplay = userQuota === 'unlimited' ? 'Unlimited' : `${userQuota}`;
                
                return (
                <button
                  key={user.user}
                  onClick={() => openUserModal(user.user)}
                  className="w-full bg-zinc-50 rounded-lg p-4 hover:bg-zinc-100 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-zinc-900 truncate flex-1 mr-2">
                      {user.user}
                    </span>
                    <span className={`text-sm font-mono ${isOverQuota ? 'text-red-600' : 'text-zinc-900'}`}>
                      {user.totalRequests.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Quota: {quotaDisplay}
                    {isOverQuota && (
                      <span className="text-red-500 ml-2">
                        +{(user.totalRequests - (userQuota as number)).toFixed(1)} over
                      </span>
                    )}
                  </div>
                </button>
              )})}
              
              {/* Mobile Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-zinc-500">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden sm:block">
            <table className="min-w-full">
            <thead className="bg-zinc-50 sticky top-0 z-20">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50 sticky left-0 z-30 min-w-40 border-r border-zinc-100">
                  User
                </th>
                <th
                  className={`px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider min-w-24 cursor-pointer hover:bg-zinc-100 select-none transition-colors ${
                    sortBy === 'quota' ? 'bg-zinc-100' : 'bg-zinc-50'
                  }`}
                  onClick={() => handleSortWithReset('quota')}
                >
                  <div className="flex items-center gap-1">
                    Quota
                    <span className="text-zinc-400">
                      {sortBy === 'quota' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                    </span>
                  </div>
                </th>
                <th 
                  className={`px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider min-w-32 cursor-pointer hover:bg-zinc-100 select-none transition-colors ${
                    sortBy === 'totalRequests' ? 'bg-zinc-100' : 'bg-zinc-50'
                  }`}
                  onClick={() => handleSortWithReset('totalRequests')}
                >
                  <div className="flex items-center gap-1">
                    Total Requests
                    <span className="text-zinc-400">
                      {sortBy === 'totalRequests' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                    </span>
                  </div>
                </th>
                {allModels.map((model) => (
                  <th
                    key={model}
                    className={`px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider min-w-28 cursor-pointer hover:bg-zinc-100 select-none transition-colors ${
                      sortBy === model ? 'bg-zinc-100' : 'bg-zinc-50'
                    }`}
                    title={model}
                    onClick={() => handleSortWithReset(model)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate max-w-20">
                        {model.length > 18 ? `${model.substring(0, 18)}...` : model}
                      </span>
                      <span className="text-zinc-400 flex-shrink-0">
                        {sortBy === model ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const isOverQuota = userQuota !== 'unlimited' && user.totalRequests > userQuota;
                const quotaDisplay = userQuota === 'unlimited' ? 'Unlimited' : userQuota.toString();
                
                return (
                <tr key={user.user} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-medium sticky left-0 z-10 bg-white border-r border-zinc-50">
                    <button
                      onClick={() => openUserModal(user.user)}
                      className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                      title={`View ${user.user}&apos;s details`}
                    >
                      {user.user}
                    </button>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-zinc-500 font-mono">
                    {quotaDisplay}
                  </td>
                  <td className={`px-5 py-3 whitespace-nowrap text-sm font-mono font-medium ${
                    isOverQuota ? 'text-red-600' : 'text-zinc-900'
                  }`}>
                    {user.totalRequests.toFixed(2)}
                    {isOverQuota && (
                      <span className="ml-1.5 text-xs text-red-500 font-normal">
                        (+{(user.totalRequests - (userQuota as number)).toFixed(1)})
                      </span>
                    )}
                  </td>
                  {allModels.map((model) => (
                    <td
                      key={`${user.user}-${model}`}
                      className="px-5 py-3 whitespace-nowrap text-sm text-zinc-500 font-mono"
                    >
                      {user.modelBreakdown[model]?.toFixed(2) || '—'}
                    </td>
                  ))}
                </tr>
              )})}
            </tbody>
          </table>
          
          {/* Desktop Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-5 py-3 flex items-center justify-between border-t border-zinc-100">
              <p className="text-sm text-zinc-500">
                {currentPage * ROWS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ROWS_PER_PAGE, sortedUserData.length)} of {sortedUserData.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-40 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
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
                      className={`w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                        currentPage === pageNum
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-40 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
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
