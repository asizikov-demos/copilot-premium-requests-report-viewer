'use client';

import { useState, useMemo, useCallback } from 'react';

import { PRICING } from '@/constants/pricing';
import { getQuotaTier, isLegacyPremiumRequestQuotaValue } from '@/utils/analytics/quota';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSortableTable } from '@/hooks/useSortableTable';
import { ProcessedData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import { formatCurrency } from '@/utils/formatters';
import {
  BillingArtifacts,
  buildBillingArtifactsFromProcessedData,
  getUserQuota,
  QuotaArtifacts,
  UsageArtifacts,
} from '@/utils/ingestion';

import { UsersConsumptionHeatmap } from './charts/UsersConsumptionHeatmap';
import { UserDetailsView } from './UserDetailsView';

type DailyCumulativeData = { date: string; [user: string]: string | number };
const ALL_FILTERS_VALUE = '__all__';

function formatHeatmapInteger(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatHeatmapAiCredits(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 10 ? 1 : 2,
  });
}

function getPlanDisplayName(quotaValue: number | 'unknown' | undefined): string {
  const tier = getQuotaTier(quotaValue);
  if (tier === 'business') return 'Business';
  if (tier === 'enterprise') return 'Enterprise';
  return 'Unknown';
}

function formatUserCount(count: number): string {
  return `${count} ${count === 1 ? 'user' : 'users'}`;
}

interface UsersOverviewProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  dailyCumulativeData: DailyCumulativeData[];
  dailyAicCumulativeData?: DailyCumulativeData[];
  quotaArtifacts: QuotaArtifacts;
  usageArtifacts: UsageArtifacts;
  billingArtifacts?: BillingArtifacts;
}

export function UsersOverview({ userData, processedData, dailyCumulativeData, dailyAicCumulativeData = [], quotaArtifacts, usageArtifacts, billingArtifacts }: UsersOverviewProps) {
  const [showChart, setShowChart] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrganization, setSelectedOrganization] = useState(ALL_FILTERS_VALUE);
  const [selectedCostCenter, setSelectedCostCenter] = useState(ALL_FILTERS_VALUE);
  const [selectedPlan, setSelectedPlan] = useState(ALL_FILTERS_VALUE);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const ROWS_PER_PAGE = 50;

  type ColumnKey = 'quota' | 'totalRequests' | 'aicGrossAmount' | 'gross' | 'discount' | 'net';

  const effectiveBillingArtifacts = useMemo(() => (
    billingArtifacts ?? buildBillingArtifactsFromProcessedData(processedData)
  ), [billingArtifacts, processedData]);

  const userCosts = effectiveBillingArtifacts.userMap;

  const hasCosts = useMemo(() => {
    for (const costs of userCosts.values()) {
      if ((costs.gross ?? 0) > 0 || (costs.net ?? 0) > 0) {
        return true;
      }
    }

    return false;
  }, [userCosts]);

  const hasAicGross = effectiveBillingArtifacts.hasAnyAicData;
  const isUsageBasedBilling = useMemo(() => {
    const hasAiCreditUsage = processedData.some((row) => row.usageUnit === 'ai_credit');
    const hasRequestUsage = processedData.some((row) => row.usageUnit === 'request' && row.requestsUsed > 0);
    return hasAiCreditUsage && !hasRequestUsage;
  }, [processedData]);
  const showRequestMetrics = !isUsageBasedBilling;
  const showAicGross = hasAicGross && !isUsageBasedBilling;
  const costLabels = useMemo(() => getBillingCostLabels(isUsageBasedBilling), [isUsageBasedBilling]);

  const columns = useMemo<ColumnKey[]>(() => [
    'quota',
    ...(showRequestMetrics ? ['totalRequests'] as ColumnKey[] : []),
    ...(showAicGross ? ['aicGrossAmount'] as ColumnKey[] : []),
    ...(hasCosts ? ['gross', 'discount', 'net'] as ColumnKey[] : [])
  ], [hasCosts, showAicGross, showRequestMetrics]);

  const getSortableValue = useCallback((row: UserSummary, column: ColumnKey) => {
    if (column === 'quota') {
      const q = getUserQuota(quotaArtifacts, row.user);
      return q === 'unknown' ? Number.NEGATIVE_INFINITY : q;
    }

    if (column === 'totalRequests') return row.totalRequests;
    if (column === 'gross' || column === 'discount' || column === 'net' || column === 'aicGrossAmount') {
      return userCosts.get(row.user)?.[column] ?? 0;
    }
    return 0;
  }, [quotaArtifacts, userCosts]);

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

  const getUserPlanLabel = useCallback((user: string): string | null => {
    const q = getUserQuota(quotaArtifacts, user);
    const tier = getQuotaTier(q);
    if (tier === 'enterprise') return 'Copilot Enterprise';
    if (tier === 'business') return 'Copilot Business';
    return null;
  }, [quotaArtifacts]);

  const getUserPlanDisplayName = useCallback((user: string): string => (
    getPlanDisplayName(getUserQuota(quotaArtifacts, user))
  ), [quotaArtifacts]);

  const planOptions = useMemo(() => {
    const plans = new Set<string>();
    for (const user of userData) {
      const plan = getUserPlanLabel(user.user);
      if (plan) plans.add(plan);
    }
    return Array.from(plans).sort();
  }, [userData, getUserPlanLabel]);

  const planSummary = useMemo(() => {
    let businessUsers = 0;
    let enterpriseUsers = 0;

    for (const user of userData) {
      const quota = getUserQuota(quotaArtifacts, user.user);
      const tier = getQuotaTier(quota);
      if (tier === 'business') {
        businessUsers += 1;
      } else if (tier === 'enterprise') {
        enterpriseUsers += 1;
      }
    }

    const totalUsers = userData.length;
    return {
      businessUsers,
      enterpriseUsers,
      otherUsers: totalUsers - businessUsers - enterpriseUsers,
      totalUsers,
    };
  }, [quotaArtifacts, userData]);

  const effectiveSelectedOrganization = organizationOptions.includes(selectedOrganization)
    ? selectedOrganization
    : ALL_FILTERS_VALUE;

  const effectiveSelectedCostCenter = costCenterOptions.includes(selectedCostCenter)
    ? selectedCostCenter
    : ALL_FILTERS_VALUE;

  const effectiveSelectedPlan = planOptions.includes(selectedPlan)
    ? selectedPlan
    : ALL_FILTERS_VALUE;

  const filteredUserData = useMemo(() => (
    userData.filter((user) => {
      const matchesSearch = searchQuery === '' || user.user.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOrganization = effectiveSelectedOrganization === ALL_FILTERS_VALUE || user.organization === effectiveSelectedOrganization;
      const matchesCostCenter = effectiveSelectedCostCenter === ALL_FILTERS_VALUE || user.costCenter === effectiveSelectedCostCenter;
      const matchesPlan = effectiveSelectedPlan === ALL_FILTERS_VALUE || getUserPlanLabel(user.user) === effectiveSelectedPlan;

      return matchesSearch && matchesOrganization && matchesCostCenter && matchesPlan;
    })
  ), [userData, searchQuery, effectiveSelectedOrganization, effectiveSelectedCostCenter, effectiveSelectedPlan, getUserPlanLabel]);

  const {
    sortedData: sortedUserData,
    sortBy,
    sortDirection,
    handleSort
  } = useSortableTable({
    data: filteredUserData,
    columns,
    getSortableValue,
    defaultSort: { column: showRequestMetrics ? 'totalRequests' : hasCosts ? 'gross' : 'quota', direction: 'desc' }
  });
  
  const filteredUsageArtifacts = useMemo(() => {
    const filteredUsers = new Set(filteredUserData.map((user) => user.user));

    return {
      ...usageArtifacts,
      users: usageArtifacts.users.filter((user) => filteredUsers.has(user.user)),
      userCount: filteredUsers.size
    };
  }, [usageArtifacts, filteredUserData]);

  // Memoize quota types calculation for chart display - NOW using O(1) quota map!
  const quotaInfo = useMemo(() => {
    const quotaTypes = new Set<number>();
    filteredUserData.forEach(user => {
      const userQuota = getUserQuota(quotaArtifacts, user.user);
      const shouldIncludeQuota = isUsageBasedBilling
        ? getQuotaTier(userQuota) !== null
        : isLegacyPremiumRequestQuotaValue(userQuota);

      if (typeof userQuota === 'number' && shouldIncludeQuota) {
        quotaTypes.add(userQuota);
      }
    });
    const hasMixedQuotas = quotaTypes.size > 1;
    return { quotaTypes, hasMixedQuotas };
  }, [filteredUserData, isUsageBasedBilling, quotaArtifacts]);

  const { quotaTypes, hasMixedQuotas } = quotaInfo;
  
  // Derive currentQuota from detected quota types for chart reference lines
  // Use first detected quota type, fallback to BUSINESS_QUOTA as default
  const currentQuota = quotaTypes.size > 0 
    ? Array.from(quotaTypes)[0] 
    : isUsageBasedBilling ? PRICING.BUSINESS_AI_CREDIT_QUOTA : PRICING.BUSINESS_QUOTA;

  const chartUsers = useMemo(() => {
    return filteredUserData.map((user) => user.user);
  }, [filteredUserData]);

  const heatmapData = isUsageBasedBilling ? dailyAicCumulativeData : dailyCumulativeData;
  const heatmapTitle = `User Consumption Density Over Time (${chartUsers.length} users)`;
  const heatmapValueAxisLabel = isUsageBasedBilling ? 'AI Credits Used' : 'Premium Requests Used';
  const heatmapValueUnitLabel = isUsageBasedBilling ? 'AI Credits' : 'requests';
  const heatmapFormatValue = isUsageBasedBilling ? formatHeatmapAiCredits : formatHeatmapInteger;
  
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
  
  if (selectedUser) {
    return (
      <UserDetailsView
        user={selectedUser}
        processedData={processedData}
        userQuotaValue={getUserQuota(quotaArtifacts, selectedUser)}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Users Overview</h2>
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

        </div>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <table className="min-w-full" aria-label="Copilot plan summary">
          <thead>
            <tr className="border-b border-[#d1d9e0]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Plan
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                Users
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d1d9e0]">
            <tr className="hover:bg-[#fcfdff] transition-colors duration-150">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">Copilot Business</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">{formatUserCount(planSummary.businessUsers)}</td>
            </tr>
            <tr className="hover:bg-[#fcfdff] transition-colors duration-150">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">Copilot Enterprise</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">{formatUserCount(planSummary.enterpriseUsers)}</td>
            </tr>
            <tr className="hover:bg-[#fcfdff] transition-colors duration-150">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">Others</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-[#636c76] text-right">{formatUserCount(planSummary.otherUsers)}</td>
            </tr>
            <tr className="bg-[#f6f8fa]">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-semibold text-[#1f2328]">Total</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold tabular-nums text-[#1f2328] text-right">{formatUserCount(planSummary.totalUsers)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-[#636c76]">
          <span className="font-medium text-[#1f2328]">Search users</span>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636c76]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              placeholder="Filter by username..."
              className="w-full min-w-56 rounded-md border border-[#d1d9e0] bg-white pl-9 pr-3 py-2 text-sm text-[#1f2328] shadow-sm outline-none transition duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 placeholder:text-[#636c76]"
            />
          </div>
        </label>

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

        {planOptions.length > 1 && (
          <label className="flex flex-col gap-1.5 text-sm text-[#636c76]">
            <span className="font-medium text-[#1f2328]">Copilot Plan</span>
            <select
              value={effectiveSelectedPlan}
              onChange={(event) => {
                setSelectedPlan(event.target.value);
                setCurrentPage(0);
              }}
              aria-label="Copilot Plan"
              className="min-w-56 rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] shadow-sm outline-none transition duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value={ALL_FILTERS_VALUE}>All plans</option>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Quota Consumption Card */}
      {(!isMobile || showChart) && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-[#1f2328]">
                  {isUsageBasedBilling ? 'AI Credits Consumption' : 'Quota Consumption'}
                </h3>
                <p className="text-xs text-[#636c76] mt-0.5">
                  {isUsageBasedBilling ? 'Daily cumulative AI Credits usage' : 'Daily cumulative premium request usage'}
                </p>
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
          <div className="p-5">
            <div className="h-72 sm:h-96 2xl:h-[28rem] relative z-30">
              <UsersConsumptionHeatmap
                dailyCumulativeData={heatmapData}
                users={chartUsers}
                currentQuota={currentQuota}
                quotaTypes={quotaTypes}
                hasMixedQuotas={hasMixedQuotas}
                showQuotaReference={quotaTypes.size > 0}
                title={heatmapTitle}
                valueAxisLabel={heatmapValueAxisLabel}
                valueUnitLabel={heatmapValueUnitLabel}
                formatValue={heatmapFormatValue}
              />
            </div>
          </div>
        </div>
      )}

      {/* Users Table Card */}
      {(!isMobile || !showChart) && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 className="text-sm font-medium text-[#1f2328]">Users</h3>
            <p className="text-xs text-[#636c76] mt-0.5">
              Showing {filteredUserData.length} of {userData.length} users
            </p>
          </div>

          {/* Mobile Summary Cards */}
          {isMobile && (
            <div className="p-4 space-y-2 sm:hidden">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const isOverQuota = isLegacyPremiumRequestQuotaValue(userQuota) && user.totalRequests > userQuota;
                const quotaDisplay = userQuota === 'unknown' ? 'Unknown' : `${userQuota}`;
                const costs = userCosts.get(user.user);
                const planDisplay = getUserPlanDisplayName(user.user);

                return (
                <button
                  key={user.user}
                  onClick={() => setSelectedUser(user.user)}
                  className="w-full bg-[#f6f8fa] rounded-md p-4 hover:bg-[#eef1f4] transition-colors duration-150 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-[#1f2328] truncate flex-1 mr-2">
                      {user.user}
                    </span>
                    {showRequestMetrics ? (
                      <span className={`text-sm font-mono ${isOverQuota ? 'text-red-600' : 'text-[#1f2328]'}`}>
                        {user.totalRequests.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-[#636c76]">
                        {planDisplay}
                      </span>
                    )}
                  </div>
                  {showRequestMetrics && (
                    <div className="text-xs text-[#636c76]">
                      Quota: {quotaDisplay}
                      {isOverQuota && (
                        <span className="text-red-500 ml-2">
                          +{(user.totalRequests - (userQuota as number)).toFixed(1)} over
                        </span>
                      )}
                    </div>
                  )}
                  {hasCosts && ((costs?.gross ?? 0) > 0 || (costs?.discount ?? 0) > 0 || (costs?.net ?? 0) > 0) && (
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-mono tabular-nums">
                      <span className="text-[#636c76]">{formatCurrency(costs?.gross ?? 0)}</span>
                      <span className="text-emerald-600">-{formatCurrency(costs?.discount ?? 0)}</span>
                      <span className="font-semibold text-[#1f2328]">{formatCurrency(costs?.net ?? 0)}</span>
                    </div>
                  )}
                  {showAicGross && (
                    <div className="mt-1.5 text-xs font-mono tabular-nums text-[#636c76]">
                      AI Credits Gross: {formatCurrency(costs?.aicGrossAmount ?? 0)}
                    </div>
                  )}
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
          <div className="hidden sm:block overflow-auto">
            <table className="min-w-full" aria-label="Users">
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
                    {isUsageBasedBilling ? 'Plan' : 'Quota'}
                    <span className="text-[#636c76]">
                      {sortBy === 'quota' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                    </span>
                  </div>
                </th>
                {showRequestMetrics && (
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
                )}
                {showAicGross && (
                  <th
                    className={`px-4 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] min-w-36 cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150 ${
                      sortBy === 'aicGrossAmount' ? 'bg-[#eef1f4]' : 'bg-[#f6f8fa]'
                    }`}
                    onClick={() => handleSortWithReset('aicGrossAmount')}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      AI Credits Gross
                      <span className="text-[#636c76]">
                        {sortBy === 'aicGrossAmount' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                      </span>
                    </div>
                  </th>
                )}
                {hasCosts && (
                  <>
                    <th
                      className={`px-4 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] min-w-28 cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150 ${
                        sortBy === 'gross' ? 'bg-[#eef1f4]' : 'bg-[#f6f8fa]'
                      }`}
                      onClick={() => handleSortWithReset('gross')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {costLabels.gross}
                        <span className="text-[#636c76]">
                          {sortBy === 'gross' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th
                      className={`px-4 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] min-w-28 cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150 ${
                        sortBy === 'discount' ? 'bg-[#eef1f4]' : 'bg-[#f6f8fa]'
                      }`}
                      onClick={() => handleSortWithReset('discount')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {costLabels.discount}
                        <span className="text-[#636c76]">
                          {sortBy === 'discount' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th
                      className={`px-4 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em] min-w-24 cursor-pointer hover:bg-[#f6f8fa] select-none transition-colors duration-150 ${
                        sortBy === 'net' ? 'bg-[#eef1f4]' : 'bg-[#f6f8fa]'
                      }`}
                      onClick={() => handleSortWithReset('net')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {costLabels.net}
                        <span className="text-[#636c76]">
                          {sortBy === 'net' ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      </div>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f6f8fa]">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const isOverQuota = isLegacyPremiumRequestQuotaValue(userQuota) && user.totalRequests > userQuota;
                const quotaDisplay = userQuota === 'unknown' ? 'Unknown' : userQuota.toString();
                const planDisplay = getUserPlanDisplayName(user.user);

                return (
                <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky left-0 z-10 bg-white border-r border-[#d1d9e0]">
                    <button
                      onClick={() => setSelectedUser(user.user)}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none"
                      title={`View ${user.user}&apos;s details`}
                    >
                      {user.user}
                    </button>
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-[#636c76] text-right ${isUsageBasedBilling ? 'font-medium' : 'font-mono tabular-nums'}`}>
                    {isUsageBasedBilling ? planDisplay : quotaDisplay}
                  </td>
                  {showRequestMetrics && (
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
                  )}
                  {(() => {
                    const costs = userCosts.get(user.user);
                    return (
                      <>
                        {showAicGross && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[#636c76] font-mono tabular-nums text-right">
                            {formatCurrency(costs?.aicGrossAmount ?? 0)}
                          </td>
                        )}
                        {hasCosts && (
                          <>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#636c76] font-mono tabular-nums text-right">
                              {formatCurrency(costs?.gross ?? 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-emerald-600 font-mono tabular-nums text-right">
                              -{formatCurrency(costs?.discount ?? 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-[#1f2328] font-mono tabular-nums text-right">
                              {formatCurrency(costs?.net ?? 0)}
                            </td>
                          </>
                        )}
                      </>
                    );
                  })()}
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
        <div className="bg-white border border-[#d1d9e0] rounded-md px-6 py-8 text-center text-[#636c76]">
          No user data available
        </div>
      )}

      {userData.length > 0 && filteredUserData.length === 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md px-6 py-8 text-center text-[#636c76]">
          No users match the current filters
        </div>
      )}
    </div>
  );
}
