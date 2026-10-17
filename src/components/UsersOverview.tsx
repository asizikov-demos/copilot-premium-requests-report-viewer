'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from '@primer/octicons-react';
import { Button, FormControl, IconButton, Link, Select, TextInput } from '@primer/react';

import { getQuotaTier, isKnownQuotaValue } from '@/utils/analytics/quota';
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
import { SortableColumnHeader } from './primitives/SortableColumnHeader';

type DailyCumulativeData = { date: string; [user: string]: string | number };
const ALL_FILTERS_VALUE = '__all__';
const NO_COST_CENTERS_FILTER_VALUE = '__no_cost_centers__';

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
  quotaArtifacts: QuotaArtifacts;
  usageArtifacts: UsageArtifacts;
  billingArtifacts?: BillingArtifacts;
}

export function UsersOverview({ userData, processedData, dailyCumulativeData, quotaArtifacts, usageArtifacts, billingArtifacts }: UsersOverviewProps) {
  const [showChart, setShowChart] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrganization, setSelectedOrganization] = useState(ALL_FILTERS_VALUE);
  const [selectedCostCenter, setSelectedCostCenter] = useState(ALL_FILTERS_VALUE);
  const [selectedPlan, setSelectedPlan] = useState(ALL_FILTERS_VALUE);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const ROWS_PER_PAGE = 50;

  type ColumnKey = 'quota' | 'totalCredits' | 'aicGrossAmount' | 'gross' | 'discount' | 'net';

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

  const costLabels = useMemo(() => getBillingCostLabels(), []);
  const userCredits = useMemo(
    () => new Map(usageArtifacts.users.map((user) => [user.user, user.totalCredits])),
    [usageArtifacts.users]
  );
  const hasMultipleMonths = useMemo(
    () => new Set(processedData.map((row) => row.monthKey)).size > 1,
    [processedData]
  );

  const columns = useMemo<ColumnKey[]>(() => [
    'quota',
    'totalCredits',
    ...(hasCosts ? ['gross', 'discount', 'net'] as ColumnKey[] : [])
  ], [hasCosts]);

  const getSortableValue = useCallback((row: UserSummary, column: ColumnKey) => {
    if (column === 'quota') {
      const q = getUserQuota(quotaArtifacts, row.user);
      return q === 'unknown' ? Number.NEGATIVE_INFINITY : q;
    }

    if (column === 'totalCredits') return userCredits.get(row.user) ?? row.totalCredits;
    if (column === 'gross' || column === 'discount' || column === 'net' || column === 'aicGrossAmount') {
      return userCosts.get(row.user)?.[column] ?? 0;
    }
    return 0;
  }, [quotaArtifacts, userCosts, userCredits]);

  const organizationOptions = useMemo(() => {
    const organizations = userData
      .map((user) => user.organization)
      .filter((organization): organization is string => Boolean(organization));

    return Array.from(new Set(organizations)).sort((a, b) => a.localeCompare(b));
  }, [userData]);

  const costCenterOptions = useMemo(() => {
    const costCenters = userData.flatMap((user) => (
      user.costCenters ?? (user.costCenter ? [user.costCenter] : [])
    ));

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

  const effectiveSelectedCostCenter = selectedCostCenter === NO_COST_CENTERS_FILTER_VALUE || costCenterOptions.includes(selectedCostCenter)
    ? selectedCostCenter
    : ALL_FILTERS_VALUE;

  const effectiveSelectedPlan = planOptions.includes(selectedPlan)
    ? selectedPlan
    : ALL_FILTERS_VALUE;

  const filteredUserData = useMemo(() => (
    userData.filter((user) => {
      const matchesSearch = searchQuery === '' || user.user.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOrganization = effectiveSelectedOrganization === ALL_FILTERS_VALUE || user.organization === effectiveSelectedOrganization;
      const userCostCenters = user.costCenters ?? (user.costCenter ? [user.costCenter] : []);
      const matchesCostCenter = effectiveSelectedCostCenter === ALL_FILTERS_VALUE
        || (effectiveSelectedCostCenter === NO_COST_CENTERS_FILTER_VALUE
          ? userCostCenters.length === 0
          : userCostCenters.includes(effectiveSelectedCostCenter));
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
    defaultSort: { column: 'totalCredits', direction: 'desc' }
  });
  
  const chartUsers = useMemo(() => {
    return filteredUserData.map((user) => user.user);
  }, [filteredUserData]);

  const heatmapTitle = `User Consumption Density Over Time (${chartUsers.length} users)`;
  
  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedUserData.length / ROWS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages - 1);
  const paginatedUserData = useMemo(() => 
    sortedUserData.slice(activePage * ROWS_PER_PAGE, (activePage + 1) * ROWS_PER_PAGE),
    [sortedUserData, activePage]
  );
  const selectedUserAggregate = useMemo(
    () => userData.find((entry) => entry.user === selectedUser),
    [selectedUser, userData]
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
        userAggregate={selectedUserAggregate ?? null}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-(--fgColor-default)">Users Overview</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {isMobile && (
            <Button size="small" onClick={() => setShowChart(!showChart)}>
              {showChart ? 'Show Table' : 'Show Chart'}
            </Button>
          )}

        </div>
      </div>

      <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
        <table className="min-w-full" aria-label="Copilot plan summary">
          <thead>
            <tr className="border-b border-(--borderColor-default)">
              <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                Plan
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                Users
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--borderColor-default)">
            <tr className="hover:bg-(--bgColor-muted) transition-colors duration-150">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-(--fgColor-default)">Copilot Business</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-(--fgColor-muted) text-right">{formatUserCount(planSummary.businessUsers)}</td>
            </tr>
            <tr className="hover:bg-(--bgColor-muted) transition-colors duration-150">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-(--fgColor-default)">Copilot Enterprise</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-(--fgColor-muted) text-right">{formatUserCount(planSummary.enterpriseUsers)}</td>
            </tr>
            <tr className="hover:bg-(--bgColor-muted) transition-colors duration-150">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-(--fgColor-default)">Others</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono tabular-nums text-(--fgColor-muted) text-right">{formatUserCount(planSummary.otherUsers)}</td>
            </tr>
            <tr className="bg-(--bgColor-muted)">
              <td className="px-5 py-3 whitespace-nowrap text-sm font-semibold text-(--fgColor-default)">Total</td>
              <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold tabular-nums text-(--fgColor-default) text-right">{formatUserCount(planSummary.totalUsers)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <FormControl>
          <FormControl.Label>Search users</FormControl.Label>
          <TextInput
            block
            size="large"
            leadingVisual={SearchIcon}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
            placeholder="Filter by username..."
            className="min-w-56"
          />
        </FormControl>

        {organizationOptions.length > 0 && (
          <FormControl>
            <FormControl.Label>Organization</FormControl.Label>
            <Select
              value={effectiveSelectedOrganization}
              onChange={(event) => {
                setSelectedOrganization(event.target.value);
                setCurrentPage(0);
              }}
              block
              size="large"
              className="min-w-56"
            >
              <Select.Option value={ALL_FILTERS_VALUE}>All organizations</Select.Option>
              {organizationOptions.map((organization) => (
                <Select.Option key={organization} value={organization}>
                  {organization}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
        )}

        {costCenterOptions.length > 0 && (
          <FormControl>
            <FormControl.Label>Cost center</FormControl.Label>
            <Select
              value={effectiveSelectedCostCenter}
              onChange={(event) => {
                setSelectedCostCenter(event.target.value);
                setCurrentPage(0);
              }}
              block
              size="large"
              className="min-w-56"
            >
              <Select.Option value={ALL_FILTERS_VALUE}>All cost centers</Select.Option>
              <Select.Option value={NO_COST_CENTERS_FILTER_VALUE}>No cost centers</Select.Option>
              {costCenterOptions.map((costCenter) => (
                <Select.Option key={costCenter} value={costCenter}>
                  {costCenter}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
        )}

        {planOptions.length > 1 && (
          <FormControl>
            <FormControl.Label>Copilot Plan</FormControl.Label>
            <Select
              value={effectiveSelectedPlan}
              onChange={(event) => {
                setSelectedPlan(event.target.value);
                setCurrentPage(0);
              }}
              block
              size="large"
              className="min-w-56"
            >
              <Select.Option value={ALL_FILTERS_VALUE}>All plans</Select.Option>
              {planOptions.map((plan) => (
                <Select.Option key={plan} value={plan}>
                  {plan}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
        )}
      </div>

      {/* AI Credits Consumption Card */}
      {(!isMobile || showChart) && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-(--fgColor-default)">
                  AI Credits Consumption
                </h3>
                <p className="text-xs text-(--fgColor-muted) mt-0.5">
                  Daily cumulative AI Credits usage
                </p>
              </div>
              {isMobile && (
                <IconButton
                  icon={XIcon}
                  variant="invisible"
                  size="small"
                  aria-label="Hide chart"
                  onClick={() => setShowChart(false)}
                />
              )}
            </div>
          </div>
          <div className="p-5">
            <div className="h-72 sm:h-96 2xl:h-[28rem] relative z-30">
              <UsersConsumptionHeatmap
                dailyCumulativeData={dailyCumulativeData}
                users={chartUsers}
                title={heatmapTitle}
                valueAxisLabel="AI Credits Used"
                valueUnitLabel="AI Credits"
                formatValue={formatHeatmapAiCredits}
              />
            </div>
          </div>
        </div>
      )}

      {/* Users Table Card */}
      {(!isMobile || !showChart) && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 className="text-sm font-medium text-(--fgColor-default)">Users</h3>
            <p className="text-xs text-(--fgColor-muted) mt-0.5">
              Showing {filteredUserData.length} of {userData.length} users
            </p>
          </div>

          {/* Mobile Summary Cards */}
          {isMobile && (
            <div className="p-4 space-y-2 sm:hidden">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const credits = userCredits.get(user.user) ?? user.totalCredits;
                const isOverQuota = !hasMultipleMonths && isKnownQuotaValue(userQuota) && credits > userQuota;
                const quotaDisplay = userQuota === 'unknown' ? 'Unknown' : `${userQuota}`;
                const costs = userCosts.get(user.user);
                const planDisplay = getUserPlanDisplayName(user.user);

                return (
                <button
                  key={user.user}
                  onClick={() => setSelectedUser(user.user)}
                  className="w-full bg-(--bgColor-muted) rounded-md p-4 hover:bg-(--bgColor-neutral-muted) transition-colors duration-150 text-left"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-(--fgColor-default) truncate flex-1 mr-2">
                      {user.user}
                    </span>
                    <span className={`text-sm font-mono ${isOverQuota ? 'text-(--fgColor-danger)' : 'text-(--fgColor-default)'}`}>
                      {credits.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs text-(--fgColor-muted)">
                      {planDisplay} · Quota: {quotaDisplay} AI Credits
                      {isOverQuota && (
                        <span className="text-(--fgColor-danger) ml-2">
                          +{(credits - (userQuota as number)).toFixed(1)} over
                        </span>
                      )}
                    </div>
                  {hasCosts && ((costs?.gross ?? 0) > 0 || (costs?.discount ?? 0) > 0 || (costs?.net ?? 0) > 0) && (
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-mono tabular-nums">
                      <span className="text-(--fgColor-muted)">{formatCurrency(costs?.gross ?? 0)}</span>
                      <span className="text-(--fgColor-success)">-{formatCurrency(costs?.discount ?? 0)}</span>
                      <span className="font-semibold text-(--fgColor-default)">{formatCurrency(costs?.net ?? 0)}</span>
                    </div>
                  )}
                </button>
              )})}

              {/* Mobile Pagination */}
              {totalPages > 1 && (
                <nav aria-label="Users pagination" className="flex items-center justify-between pt-3 border-t border-(--borderColor-default)">
                  <Button
                    variant="invisible"
                    size="small"
                    leadingVisual={ArrowLeftIcon}
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={activePage === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-(--fgColor-muted)">
                    Page {activePage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="invisible"
                    size="small"
                    trailingVisual={ArrowRightIcon}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={activePage === totalPages - 1}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-auto">
            <table className="min-w-full" aria-label="Users">
            <thead className="bg-(--bgColor-muted) sticky top-0 z-20">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-[0.05em] bg-(--bgColor-muted) sticky left-0 z-30 min-w-40 border-r border-(--borderColor-default)">
                  User
                </th>
                <SortableColumnHeader
                  label="Quota"
                  active={sortBy === 'quota'}
                  direction={sortDirection}
                  onSort={() => handleSortWithReset('quota')}
                  className="min-w-24"
                />
                <SortableColumnHeader
                  label="Total AI Credits"
                  active={sortBy === 'totalCredits'}
                  direction={sortDirection}
                  onSort={() => handleSortWithReset('totalCredits')}
                  className="min-w-32"
                />
                {hasCosts && (
                  <>
                    <SortableColumnHeader
                      label={costLabels.gross}
                      active={sortBy === 'gross'}
                      direction={sortDirection}
                      onSort={() => handleSortWithReset('gross')}
                      className="min-w-28"
                    />
                    <SortableColumnHeader
                      label={costLabels.discount}
                      active={sortBy === 'discount'}
                      direction={sortDirection}
                      onSort={() => handleSortWithReset('discount')}
                      className="min-w-28"
                    />
                    <SortableColumnHeader
                      label={costLabels.net}
                      active={sortBy === 'net'}
                      direction={sortDirection}
                      onSort={() => handleSortWithReset('net')}
                      className="min-w-24"
                    />
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--borderColor-muted)">
              {paginatedUserData.map((user) => {
                const userQuota = getUserQuota(quotaArtifacts, user.user);
                const credits = userCredits.get(user.user) ?? user.totalCredits;
                const isOverQuota = !hasMultipleMonths && isKnownQuotaValue(userQuota) && credits > userQuota;
                const quotaDisplay = userQuota === 'unknown' ? 'Unknown' : userQuota.toString();

                return (
                <tr key={user.user} className="group hover:bg-(--bgColor-muted) transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium sticky left-0 z-10 bg-(--bgColor-default) group-hover:bg-(--bgColor-muted) transition-colors duration-150 border-r border-(--borderColor-default)">
                    <Link
                      as="button"
                      type="button"
                      onClick={() => setSelectedUser(user.user)}
                      title={`View ${user.user}'s details`}
                    >
                      {user.user}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">
                    {quotaDisplay}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono font-medium tabular-nums text-right ${
                      isOverQuota ? 'text-(--fgColor-danger)' : 'text-(--fgColor-default)'
                    }`}>
                      {credits.toFixed(2)}
                      {isOverQuota && (
                        <span className="ml-1.5 text-xs text-(--fgColor-danger) font-normal">
                          (+{(credits - (userQuota as number)).toFixed(1)})
                        </span>
                      )}
                    </td>
                  {(() => {
                    const costs = userCosts.get(user.user);
                    return (
                      <>
                        {hasCosts && (
                          <>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-(--fgColor-muted) font-mono tabular-nums text-right">
                              {formatCurrency(costs?.gross ?? 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-(--fgColor-success) font-mono tabular-nums text-right">
                              -{formatCurrency(costs?.discount ?? 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-(--fgColor-default) font-mono tabular-nums text-right">
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
            <div className="bg-(--bgColor-default) px-4 py-3 flex items-center justify-between border-t border-(--borderColor-default)">
              <p className="text-sm text-(--fgColor-muted)">
                {activePage * ROWS_PER_PAGE + 1}–{Math.min((activePage + 1) * ROWS_PER_PAGE, sortedUserData.length)} of {sortedUserData.length}
              </p>
              <nav aria-label="Users pagination" className="flex items-center gap-1">
                <IconButton
                  icon={ChevronLeftIcon}
                  variant="invisible"
                  aria-label="Previous page"
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={activePage === 0}
                />

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
                      type="button"
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      aria-label={`Page ${pageNum + 1}`}
                      aria-current={activePage === pageNum ? 'page' : undefined}
                      className={`w-8 h-8 text-sm font-medium rounded-md border transition-colors duration-150 ${
                        activePage === pageNum
                          ? 'bg-(--bgColor-accent-emphasis) text-(--fgColor-onEmphasis) border-(--borderColor-accent-emphasis)'
                          : 'text-(--fgColor-muted) border-(--borderColor-default) hover:bg-(--control-transparent-bgColor-hover)'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}

                <IconButton
                  icon={ChevronRightIcon}
                  variant="invisible"
                  aria-label="Next page"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={activePage === totalPages - 1}
                />
              </nav>
            </div>
          )}
          </div>
        </div>
      )}

      {userData.length === 0 && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md px-6 py-8 text-center text-(--fgColor-muted)">
          No user data available
        </div>
      )}

      {userData.length > 0 && filteredUserData.length === 0 && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md px-6 py-8 text-center text-(--fgColor-muted)">
          No users match the current filters
        </div>
      )}
    </div>
  );
}
