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
import type { UserSummary } from '@/utils/analytics';
import { getUserQuota, QuotaArtifacts, UsageArtifacts, computeOverageSummaryFromArtifacts } from '@/utils/ingestion';

type DailyCumulativeData = { date: string; [user: string]: string | number };
const ALL_FILTERS_VALUE = '__all__';

interface UsersOverviewProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  allModels: string[];
  dailyCumulativeData: DailyCumulativeData[];
  quotaArtifacts: QuotaArtifacts;
  usageArtifacts: UsageArtifacts; // NEW: used for overage + future enhancements
  onBack?: () => void;
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
  const [selectedOrganization, setSelectedOrganization] = useState(ALL_FILTERS_VALUE);
  const [selectedCostCenter, setSelectedCostCenter] = useState(ALL_FILTERS_VALUE);
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

  const organizationOptions = useMemo(() => {
    const organizations = userData
      .map((user) => user.organization)
      .filter((organization): organization is string => Boolean(organization));

    return Array.from(new Set(organizations)).sort((a, b) => a.localeCompare(b));
  }, [userData]);

  const costCenterOptions = useMemo(() => {
    const costCenters = userData
      .map((user) => user.costCenter)
      .filter((costCenter): costCenter is string => Boolean(costCenter));

    return Array.from(new Set(costCenters)).sort((a, b) => a.localeCompare(b));
  }, [userData]);

  const effectiveSelectedOrganization = organizationOptions.includes(selectedOrganization)
    ? selectedOrganization
    : ALL_FILTERS_VALUE;

  const effectiveSelectedCostCenter = costCenterOptions.includes(selectedCostCenter)
    ? selectedCostCenter
    : ALL_FILTERS_VALUE;

  const filteredUserData = useMemo(() => (
    userData.filter((user) => {
      const matchesOrganization = effectiveSelectedOrganization === ALL_FILTERS_VALUE || user.organization === effectiveSelectedOrganization;
      const matchesCostCenter = effectiveSelectedCostCenter === ALL_FILTERS_VALUE || user.costCenter === effectiveSelectedCostCenter;

      return matchesOrganization && matchesCostCenter;
    })
  ), [userData, effectiveSelectedOrganization, effectiveSelectedCostCenter]);

  const {
    sortedData: sortedUserData,
    sortBy,
    sortDirection,
    handleSort
  } = useSortableTable({
    data: filteredUserData,
    columns,
    getSortableValue,
    defaultSort: { column: 'totalRequests', direction: 'desc' }
  });
  
  const filteredUsageArtifacts = useMemo(() => {
    const filteredUsers = new Set(filteredUserData.map((user) => user.user));

    return {
      ...usageArtifacts,
      users: usageArtifacts.users.filter((user) => filteredUsers.has(user.user)),
      userCount: filteredUsers.size
    };
  }, [usageArtifacts, filteredUserData]);

  // Calculate total overage directly from artifacts (O(U))
  const { totalOverageRequests, totalOverageCost } = useMemo(() => (
    computeOverageSummaryFromArtifacts(filteredUsageArtifacts, quotaArtifacts)
  ), [filteredUsageArtifacts, quotaArtifacts]);
  
  // Memoize quota types calculation for chart display - NOW using O(1) quota map!
  const quotaInfo = useMemo(() => {
    const quotaTypes = new Set<number>();
    filteredUserData.forEach(user => {
      const userQuota = getUserQuota(quotaArtifacts, user.user);
      if (userQuota !== 'unlimited') {
        quotaTypes.add(userQuota);
      }
    });
    const hasMixedQuotas = quotaTypes.size > 1;
    const hasMixedLicenses = quotaTypes.has(PRICING.BUSINESS_QUOTA) && quotaTypes.has(PRICING.ENTERPRISE_QUOTA);
    return { quotaTypes, hasMixedQuotas, hasMixedLicenses };
  }, [filteredUserData, quotaArtifacts]);

  const { quotaTypes, hasMixedQuotas, hasMixedLicenses } = quotaInfo;
  
  // Derive currentQuota from detected quota types for chart reference lines
  // Use first detected quota type, fallback to BUSINESS_QUOTA as default
  const currentQuota = quotaTypes.size > 0 
    ? Array.from(quotaTypes)[0] 
    : PRICING.BUSINESS_QUOTA;
  
  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedUserData.length / ROWS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages - 1);
  const paginatedUserData = useMemo(() => 
    sortedUserData.slice(activePage * ROWS_PER_PAGE, (activePage + 1) * ROWS_PER_PAGE),
    [sortedUserData, activePage]
  );

  // Reset to first page when sorting changes
  const handleSortWithReset = (column: ColumnKey) => {
    handleSort(column);
    setCurrentPage(0);
  };
  
  // Memoize chart data to prevent recalculation on pagination/sorting
  const chartData = useMemo(() => {
    const users = filteredUserData.map((user) => user.user);
    return {
      users,
      colors: generateUserColors(users)
    };
  }, [filteredUserData]);

  const { users: chartUsers, colors: userColors } = chartData;

  return (
    <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden h-full flex flex-col">
      {/* Enhanced Header */}
      <div className="px-5 py-4 border-b border-[#d1d9e0] flex flex-col gap-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#1f2328]">Users Overview</h3>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mt-1">
              <p className="text-sm text-[#636c76]">
                {hasMixedLicenses ? (
                  <>Business ({PRICING.BUSINESS_QUOTA}) & Enterprise ({PRICING.ENTERPRISE_QUOTA})</>
                ) : quotaTypes.has(PRICING.ENTERPRISE_QUOTA) ? (
                  <>Copilot Enterprise — {PRICING.ENTERPRISE_QUOTA} requests/mo</>
                ) : quotaTypes.has(PRICING.BUSINESS_QUOTA) ? (
                  <>Copilot Business — {PRICING.BUSINESS_QUOTA} requests/mo</>
                ) : (
                  <>Unlimited quota</>
                )}
              </p>
              {totalOverageRequests > 0 && (
                <p className="text-sm font-medium text-red-600">
                  Overage: ${totalOverageCost.toFixed(2)}
                </p>
              )}
              <p className="text-sm text-[#636c76]">
                Showing {filteredUserData.length} of {userData.length} users
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {isMobile && (
              <button
                onClick={() => setShowChart(!showChart)}
                className="px-3 py-1.5 text-sm font-medium text-[#636c76] bg-[#f6f8fa] hover:bg-[#d1d9e0] rounded-md transition-colors duration-150"
              >
                {showChart ? 'Show Table' : 'Show Chart'}
              </button>
            )}
            
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#636c76] bg-white border border-[#d1d9e0] rounded-md hover:bg-[#fcfdff] hover:border-[#636c76] transition-colors duration-150"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
            )}
          </div>
        </div>

        {(organizationOptions.length > 0 || costCenterOptions.length > 0) && (
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            {organizationOptions.length > 0 && (
              <label className="flex flex-col gap-1.5 text-sm text-[#636c76]">
                <span className="font-medium text-[#1f2328]">Organization</span>
                <select
                  value={effectiveSelectedOrganization}
                  onChange={(event) => {
                    setSelectedOrganization(event.target.value);
                    setCurrentPage(0);
                  }}
                  aria-label="Organization"
                  className="min-w-56 rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] shadow-sm outline-none transition duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value={ALL_FILTERS_VALUE}>All organizations</option>
                  {organizationOptions.map((organization) => (
                    <option key={organization} value={organization}>
                      {organization}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {costCenterOptions.length > 0 && (
              <label className="flex flex-col gap-1.5 text-sm text-[#636c76]">
                <span className="font-medium text-[#1f2328]">Cost center</span>
                <select
                  value={effectiveSelectedCostCenter}
                  onChange={(event) => {
                    setSelectedCostCenter(event.target.value);
                    setCurrentPage(0);
                  }}
                  aria-label="Cost center"
                  className="min-w-56 rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] shadow-sm outline-none transition duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value={ALL_FILTERS_VALUE}>All cost centers</option>
                  {costCenterOptions.map((costCenter) => (
                    <option key={costCenter} value={costCenter}>
                      {costCenter}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
      
      {/* Conditional Chart - Collapsible on Mobile */}
      {(!isMobile || showChart) && (
        <div className="px-5 py-4 bg-[#f6f8fa] border-b border-[#d1d9e0] flex-shrink-0 relative z-30">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-medium text-[#1f2328]">Quota Consumption</h4>
            <div className="flex items-center gap-3">
              <div className="flex bg-white border border-[#d1d9e0] rounded-md p-0.5">
                <button
                  onClick={() => setChartType('heatmap')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 ${
                    chartType === 'heatmap'
                      ? 'bg-indigo-500 text-white'
                      : 'text-[#636c76] hover:text-[#1f2328]'
                  }`}
                >
                  Heatmap
                </button>
                <button
                  onClick={() => setChartType('lines')}
                  disabled={chartUsers.length > 1000}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 ${
                    chartType === 'lines'
                      ? 'bg-indigo-500 text-white'
                      : 'text-[#636c76] hover:text-[#1f2328]'
                  } ${chartUsers.length > 1000 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={chartUsers.length > 1000 ? `Cannot display ${chartUsers.length} users` : undefined}
                >
                  Lines
                </button>
              </div>
              {isMobile && (
                <button
                  onClick={() => setShowChart(false)}
                  className="text-[#636c76] hover:text-[#1f2328]"
                  aria-label="Hide chart"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="h-72 sm:h-96 2xl:h-[28rem] relative z-30">
            {chartType === 'heatmap' ? (
              <UsersConsumptionHeatmap
                dailyCumulativeData={dailyCumulativeData}
                users={chartUsers}
                currentQuota={currentQuota}
                quotaTypes={quotaTypes}
                hasMixedQuotas={hasMixedQuotas}
              />
            ) : chartUsers.length > 1000 ? (
              <div className="flex items-center justify-center h-full bg-[#f6f8fa] rounded-md">
                <div className="text-center p-6">
                  <p className="text-sm font-medium text-[#1f2328] mb-1">Too many users</p>
                  <p className="text-xs text-[#636c76]">
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
                  className="w-full bg-[#f6f8fa] rounded-md p-4 hover:bg-[#eef1f4] transition-colors duration-150 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-[#1f2328] truncate flex-1 mr-2">
                      {user.user}
                    </span>
                    <span className={`text-sm font-mono ${isOverQuota ? 'text-red-600' : 'text-[#1f2328]'}`}>
                      {user.totalRequests.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs text-[#636c76]">
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
                <div className="flex items-center justify-between pt-3 border-t border-[#d1d9e0]">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={activePage === 0}
                    className="px-3 py-1.5 text-sm font-medium text-[#636c76] hover:text-[#1f2328] disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-[#636c76]">
                    {activePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={activePage === totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium text-[#636c76] hover:text-[#1f2328] disabled:opacity-40"
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
            <thead className="bg-[#f6f8fa] sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] bg-[#f6f8fa] sticky left-0 z-30 min-w-40 border-r border-[#d1d9e0]">
                  User
                </th>
                <th
                  className={`px-4 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] min-w-24 cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150 ${
                    sortBy === 'quota' ? 'bg-[#eef1f4]' : 'bg-[#f6f8fa]'
                  }`}
                  onClick={() => handleSortWithReset('quota')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Quota
                    <span className="text-[#636c76]">
                      {sortBy === 'quota' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                    </span>
                  </div>
                </th>
                <th 
                  className={`px-4 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] min-w-32 cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150 ${
                    sortBy === 'totalRequests' ? 'bg-[#f6f8fa]' : 'bg-[#f6f8fa]'
                  }`}
                  onClick={() => handleSortWithReset('totalRequests')}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Total Requests
                    <span className="text-[#636c76]">
                      {sortBy === 'totalRequests' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                    </span>
                  </div>
                </th>
                {allModels.map((model) => (
                  <th
                    key={model}
                    className={`px-4 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] min-w-28 cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150 ${
                      sortBy === model ? 'bg-[#f6f8fa]' : 'bg-[#f6f8fa]'
                    }`}
                    title={model}
                    onClick={() => handleSortWithReset(model)}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span className="truncate max-w-20">
                        {model.length > 18 ? `${model.substring(0, 18)}...` : model}
                      </span>
                      <span className="text-[#636c76] flex-shrink-0">
                        {sortBy === model ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f6f8fa]">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const isOverQuota = userQuota !== 'unlimited' && user.totalRequests > userQuota;
                const quotaDisplay = userQuota === 'unlimited' ? 'Unlimited' : userQuota.toString();
                
                return (
                <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky left-0 z-10 bg-white border-r border-[#d1d9e0]">
                    <button
                      onClick={() => openUserModal(user.user)}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none"
                      title={`View ${user.user}&apos;s details`}
                    >
                      {user.user}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[#636c76] font-mono tabular-nums text-right">
                    {quotaDisplay}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono font-medium tabular-nums text-right ${
                    isOverQuota ? 'text-red-600' : 'text-[#1f2328]'
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
                      className="px-4 py-3 whitespace-nowrap text-sm text-[#636c76] font-mono tabular-nums text-right"
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
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-[#d1d9e0]">
              <p className="text-sm text-[#636c76]">
                {activePage * ROWS_PER_PAGE + 1}–{Math.min((activePage + 1) * ROWS_PER_PAGE, sortedUserData.length)} of {sortedUserData.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={activePage === 0}
                  className="p-1.5 text-[#636c76] hover:text-[#1f2328] disabled:opacity-40 transition-colors duration-150"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i;
                  } else if (activePage < 3) {
                    pageNum = i;
                  } else if (activePage > totalPages - 4) {
                    pageNum = totalPages - 5 + i;
                  } else {
                    pageNum = activePage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 text-sm font-medium rounded-md border transition-colors duration-150 ${
                        activePage === pageNum
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'text-[#636c76] border-[#d1d9e0] hover:bg-[#f6f8fa]'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={activePage === totalPages - 1}
                  className="p-1.5 text-[#636c76] hover:text-[#1f2328] disabled:opacity-40 transition-colors duration-150"
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
        <div className="px-6 py-8 text-center text-[#636c76] flex-shrink-0">
          No user data available
        </div>
      )}

      {userData.length > 0 && filteredUserData.length === 0 && (
        <div className="px-6 py-8 text-center text-[#636c76] flex-shrink-0">
          No users match the current filters
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
