'use client';

import React, { useMemo, useState } from 'react';

import { ModelDailyStackedChart } from '@/components/charts/ModelDailyStackedChart';
import type { ProcessedData } from '@/types/csv';
import type { BillingCostLabels } from '@/utils/billingLabels';
import { enumerateDatesInclusive } from '@/utils/dateKeys';
import { formatCurrency, formatDecimalQuantity } from '@/utils/formatters';
import {
  accumulateProductCost,
  aggregateProductCosts,
  createEmptyProductCostMap,
  getPopulatedProductCosts,
  type ProductCost,
} from '@/utils/productCosts';
import type { ProductCategory } from '@/utils/productClassification';

const PRODUCT_CATEGORY_COLORS: Record<ProductCategory, string> = {
  'Copilot': '#6366f1',
  'Spark': '#f59e0b',
  'Coding Agent': '#06b6d4',
  'Code Review': '#8b5cf6',
  'Code Quality': '#22c55e',
  'Code Review for Non-Copilot Users': '#14b8a6',
};
const USERS_PER_PAGE = 50;

interface BillingGroupDailyRow {
  date: string;
  quantity: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
  products: ProductCost[];
}

interface BillingGroupUserRow {
  user: string;
  quantity: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
}

interface BillingGroupDailyChartDatum {
  date: string;
  totalRequests: number;
  [product: string]: string | number;
}

export interface BillingGroupDetailsViewProps {
  /** Name of the selected group, e.g. an organization or a cost center. */
  groupName: string;
  /** Lowercase singular noun for the group, e.g. `organization`. */
  groupLabel: string;
  /** Lowercase plural noun used as the breadcrumb root, e.g. `organizations`. */
  groupsLabel: string;
  /** Prefix for the generated daily breakdown detail element ids. */
  detailIdPrefix: string;
  rows: ProcessedData[];
  isUsageBasedBilling: boolean;
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
  hasAicGross: boolean;
  /** Renders a searchable per-user spend table for the group. */
  showUsers?: boolean;
  onBack: () => void;
}

function getRowQuantity(row: ProcessedData): number {
  return row.billingQuantity ?? row.requestsUsed;
}

function formatUtcDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

function buildDailyRows(rows: ProcessedData[]): BillingGroupDailyRow[] {
  if (rows.length === 0) {
    return [];
  }

  const buckets = new Map<string, Map<ProductCategory, ProductCost>>();
  let earliest = rows[0].dateKey;
  let latest = rows[0].dateKey;

  for (const row of rows) {
    if (row.dateKey < earliest) {
      earliest = row.dateKey;
    }
    if (row.dateKey > latest) {
      latest = row.dateKey;
    }

    let bucket = buckets.get(row.dateKey);
    if (!bucket) {
      bucket = createEmptyProductCostMap();
      buckets.set(row.dateKey, bucket);
    }
    accumulateProductCost(bucket, row);
  }

  return enumerateDatesInclusive(earliest, latest).map((date) => {
    const bucket = buckets.get(date);
    const products = bucket ? getPopulatedProductCosts(bucket) : [];

    return {
      date,
      quantity: products.reduce((total, product) => total + product.requests, 0),
      gross: products.reduce((total, product) => total + product.gross, 0),
      discount: products.reduce((total, product) => total + product.discount, 0),
      net: products.reduce((total, product) => total + product.net, 0),
      aicGrossAmount: products.reduce((total, product) => total + product.aicGrossAmount, 0),
      products,
    };
  });
}

export function BillingGroupDetailsView({
  groupName,
  groupLabel,
  groupsLabel,
  detailIdPrefix,
  rows,
  isUsageBasedBilling,
  quantityColumnLabel,
  costLabels,
  hasAicGross,
  showUsers = false,
  onBack,
}: BillingGroupDetailsViewProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(0);

  const productCosts = useMemo(() => aggregateProductCosts(rows), [rows]);
  const dailyRows = useMemo(() => buildDailyRows(rows), [rows]);

  const userCount = useMemo(() => {
    const users = new Set<string>();
    for (const row of rows) {
      if (!row.isNonCopilotUsage) {
        users.add(row.user);
      }
    }
    return users.size;
  }, [rows]);

  const totals = useMemo(() => rows.reduce(
    (accumulator, row) => ({
      quantity: accumulator.quantity + getRowQuantity(row),
      gross: accumulator.gross + (row.grossAmount ?? 0),
      discount: accumulator.discount + (row.discountAmount ?? 0),
      net: accumulator.net + (row.netAmount ?? 0),
      aicGrossAmount: accumulator.aicGrossAmount + (row.aicGrossAmount ?? 0),
    }),
    { quantity: 0, gross: 0, discount: 0, net: 0, aicGrossAmount: 0 }
  ), [rows]);

  const userRows = useMemo((): BillingGroupUserRow[] => {
    if (!showUsers) {
      return [];
    }

    const buckets = new Map<string, BillingGroupUserRow>();

    for (const row of rows) {
      // Special usage buckets are not attributable to a real user.
      if (row.isNonCopilotUsage) {
        continue;
      }

      let bucket = buckets.get(row.user);
      if (!bucket) {
        bucket = { user: row.user, quantity: 0, gross: 0, discount: 0, net: 0, aicGrossAmount: 0 };
        buckets.set(row.user, bucket);
      }

      bucket.quantity += getRowQuantity(row);
      bucket.gross += row.grossAmount ?? 0;
      bucket.discount += row.discountAmount ?? 0;
      bucket.net += row.netAmount ?? 0;
      bucket.aicGrossAmount += row.aicGrossAmount ?? 0;
    }

    return [...buckets.values()].sort(
      (a, b) => b.net - a.net || b.quantity - a.quantity || a.user.localeCompare(b.user)
    );
  }, [rows, showUsers]);

  const filteredUserRows = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    return query === '' ? userRows : userRows.filter((row) => row.user.toLowerCase().includes(query));
  }, [userRows, userSearch]);
  const totalUserPages = Math.max(1, Math.ceil(filteredUserRows.length / USERS_PER_PAGE));
  const activeUserPage = Math.min(userPage, totalUserPages - 1);
  const paginatedUserRows = useMemo(
    () => filteredUserRows.slice(
      activeUserPage * USERS_PER_PAGE,
      (activeUserPage + 1) * USERS_PER_PAGE
    ),
    [activeUserPage, filteredUserRows]
  );

  const productLabels = useMemo(() => productCosts.map((product) => product.label), [productCosts]);
  const productColors = useMemo(() => Object.fromEntries(
    productCosts.map((product) => [product.label, PRODUCT_CATEGORY_COLORS[product.category]])
  ), [productCosts]);

  const chartData = useMemo((): BillingGroupDailyChartDatum[] => dailyRows.map((row) => {
    const datum: BillingGroupDailyChartDatum = { date: row.date, totalRequests: row.quantity };

    for (const label of productLabels) {
      datum[label] = 0;
    }
    for (const product of row.products) {
      datum[product.label] = product.requests;
    }

    return datum;
  }), [dailyRows, productLabels]);

  const showCosts = totals.gross > 0 || totals.net > 0;
  const detailColSpan = 2 + (hasAicGross ? 1 : 0) + (showCosts ? 3 : 0);

  const handleCopyGroupName = async () => {
    try {
      await navigator.clipboard.writeText(groupName);
    } catch (error) {
      console.error(`Failed to copy ${groupLabel} to clipboard:`, error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
              <button
                type="button"
                onClick={onBack}
                className="text-2xl font-semibold tracking-tight text-[#0969da] hover:underline focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
              >
                {groupsLabel}
              </button>
            </li>
            <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-[#8c959f]">/</li>
            <li>
              <button
                type="button"
                onClick={handleCopyGroupName}
                title={`Click to copy ${groupLabel}`}
                className="text-2xl font-semibold tracking-tight text-[#1f2328] hover:text-indigo-600 transition-colors duration-150 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm inline-flex items-center gap-2 group"
              >
                {groupName}
                <svg
                  className="w-5 h-5 text-[#636c76] group-hover:text-indigo-600 transition-colors duration-150"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
              </button>
            </li>
          </ol>
        </nav>

        <p className="text-sm text-[#636c76] mt-1">
          {userCount} {userCount === 1 ? 'user' : 'users'}
        </p>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <table className="min-w-full" aria-label="Summary">
          <thead>
            <tr className="border-b border-[#d1d9e0]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{quantityColumnLabel}</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.gross}</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.discountSummary}</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.netSummary}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] font-mono tabular-nums">{formatDecimalQuantity(totals.quantity)}</td>
              <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(totals.gross)}</td>
              <td className="px-5 py-3 text-sm text-emerald-600 text-right font-mono tabular-nums">-{formatCurrency(totals.discount)}</td>
              <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] text-right font-mono tabular-nums">{formatCurrency(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">Spend per Product</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            {isUsageBasedBilling ? 'AI credit consumption' : 'Premium request consumption'} attributed to this {groupLabel}.
          </p>
        </div>
        {productCosts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Spend per product">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Product</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{quantityColumnLabel}</th>
                  {hasAicGross && (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">AI Credits Gross</th>
                  )}
                  {showCosts && (
                    <>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.gross}</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.discount}</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.net}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {productCosts.map((product) => (
                  <tr key={product.label} className="hover:bg-[#fcfdff] transition-colors duration-150">
                    <td className="px-5 py-3 text-sm font-medium text-[#1f2328]">{product.label}</td>
                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatDecimalQuantity(product.requests)}</td>
                    {hasAicGross && (
                      <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(product.aicGrossAmount)}</td>
                    )}
                    {showCosts && (
                      <>
                        <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(product.gross)}</td>
                        <td className="px-5 py-3 text-sm text-emerald-600 text-right font-mono tabular-nums">-{formatCurrency(product.discount)}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] text-right font-mono tabular-nums">{formatCurrency(product.net)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
            No data available
          </div>
        )}
      </div>

      {showUsers && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-[#1f2328]">Users</h3>
              <p className="text-xs text-[#636c76] mt-0.5">
                Showing {filteredUserRows.length} of {userRows.length} {userRows.length === 1 ? 'user' : 'users'} in this {groupLabel}.
              </p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm text-[#636c76]">
              <span className="sr-only">Search users</span>
              <div className="relative">
                <svg
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636c76]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(event) => {
                    setUserSearch(event.target.value);
                    setUserPage(0);
                  }}
                  placeholder="Filter by username..."
                  aria-label="Search users"
                  className="w-full min-w-56 rounded-md border border-[#d1d9e0] bg-white pl-9 pr-3 py-2 text-sm text-[#1f2328] shadow-sm outline-none transition duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 placeholder:text-[#636c76]"
                />
              </div>
            </label>
          </div>
          {filteredUserRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full" aria-label="Users">
                <thead>
                  <tr className="border-b border-[#d1d9e0]">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">User</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{quantityColumnLabel}</th>
                    {hasAicGross && (
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">AI Credits Gross</th>
                    )}
                    {showCosts && (
                      <>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.gross}</th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.discount}</th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.net}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d1d9e0]">
                  {paginatedUserRows.map((row) => (
                    <tr key={row.user} className="hover:bg-[#fcfdff] transition-colors duration-150">
                      <td className="px-5 py-3 text-sm font-medium text-[#1f2328]">{row.user}</td>
                      <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatDecimalQuantity(row.quantity)}</td>
                      {hasAicGross && (
                        <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(row.aicGrossAmount)}</td>
                      )}
                      {showCosts && (
                        <>
                          <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(row.gross)}</td>
                          <td className="px-5 py-3 text-sm text-emerald-600 text-right font-mono tabular-nums">-{formatCurrency(row.discount)}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] text-right font-mono tabular-nums">{formatCurrency(row.net)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalUserPages > 1 && (
                <div className="bg-white px-5 py-3 flex items-center justify-between border-t border-[#d1d9e0]">
                  <p className="text-sm text-[#636c76]">
                    {activeUserPage * USERS_PER_PAGE + 1}–{Math.min(
                      (activeUserPage + 1) * USERS_PER_PAGE,
                      filteredUserRows.length
                    )} of {filteredUserRows.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setUserPage((page) => Math.max(0, page - 1))}
                      disabled={activeUserPage === 0}
                      aria-label="Previous users page"
                      className="p-1.5 text-[#636c76] hover:text-[#1f2328] disabled:opacity-40 transition-colors duration-150"
                    >
                      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="px-2 text-sm text-[#636c76]">
                      {activeUserPage + 1} / {totalUserPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUserPage((page) => Math.min(totalUserPages - 1, page + 1))}
                      disabled={activeUserPage === totalUserPages - 1}
                      aria-label="Next users page"
                      className="p-1.5 text-[#636c76] hover:text-[#1f2328] disabled:opacity-40 transition-colors duration-150"
                    >
                      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m9 5 7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
              {userRows.length === 0 ? 'No data available' : `No users match "${userSearch}"`}
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
        <h3 className="text-sm font-medium text-[#1f2328] mb-1">Daily Consumption</h3>
        <p className="text-xs text-[#636c76] mb-4">Daily {quantityColumnLabel.toLowerCase()} stacked by product.</p>
        {chartData.length > 0 ? (
          <div className="h-72 sm:h-96 w-full">
            <ModelDailyStackedChart
              data={chartData}
              models={productLabels}
              modelColors={productColors}
              valueUnitLabel={quantityColumnLabel.toLowerCase()}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-[#636c76] text-sm">
            No data available
          </div>
        )}
      </div>

      {dailyRows.length > 0 && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0]">
            <h3 className="text-sm font-medium text-[#1f2328]">Daily Consumption Breakdown</h3>
            <p className="text-xs text-[#636c76] mt-0.5">Expand a day to view consumption by product.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Daily consumption breakdown">
              <thead>
                <tr className="border-b border-[#d1d9e0]">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Date</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{quantityColumnLabel}</th>
                  {hasAicGross && (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">AI Credits Gross</th>
                  )}
                  {showCosts && (
                    <>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.gross}</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.discount}</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">{costLabels.net}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d9e0]">
                {dailyRows.map((row, index) => {
                  const isExpanded = expandedDate === row.date;
                  const detailsId = `${detailIdPrefix}-${index}`;

                  return (
                    <React.Fragment key={row.date}>
                      <tr className="hover:bg-[#fcfdff] transition-colors duration-150">
                        <td className="px-5 py-3.5 text-sm font-medium text-[#1f2328]">
                          {row.products.length > 0 ? (
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 text-left"
                              aria-expanded={isExpanded}
                              aria-controls={detailsId}
                              onClick={() => setExpandedDate(isExpanded ? null : row.date)}
                            >
                              <svg
                                aria-hidden="true"
                                className={`h-4 w-4 shrink-0 text-[#636c76] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                viewBox="0 0 24 24"
                              >
                                <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {formatUtcDate(row.date)}
                            </button>
                          ) : (
                            <span className="flex items-center gap-3 pl-7">{formatUtcDate(row.date)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-[#1f2328] text-right font-mono tabular-nums">
                          {formatDecimalQuantity(row.quantity)}
                        </td>
                        {hasAicGross && (
                          <td className="px-5 py-3.5 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(row.aicGrossAmount)}</td>
                        )}
                        {showCosts && (
                          <>
                            <td className="px-5 py-3.5 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(row.gross)}</td>
                            <td className="px-5 py-3.5 text-sm text-emerald-600 text-right font-mono tabular-nums">-{formatCurrency(row.discount)}</td>
                            <td className="px-5 py-3.5 text-sm font-semibold text-[#1f2328] text-right font-mono tabular-nums">{formatCurrency(row.net)}</td>
                          </>
                        )}
                      </tr>
                      {isExpanded && row.products.length > 0 && (
                        <tr>
                          <td id={detailsId} colSpan={detailColSpan} className="p-0">
                            <table className="min-w-full bg-[#f6f8fa]" aria-label={`${formatUtcDate(row.date)} product consumption`}>
                              <thead>
                                <tr className="border-y border-[#d1d9e0]">
                                  <th className="px-12 py-2.5 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider">Product</th>
                                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider">{quantityColumnLabel}</th>
                                  {hasAicGross && (
                                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider">AI Credits Gross</th>
                                  )}
                                  {showCosts && (
                                    <>
                                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider">{costLabels.gross}</th>
                                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider">{costLabels.discount}</th>
                                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider">{costLabels.net}</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#d1d9e0]">
                                {row.products.map((product) => (
                                  <tr key={product.label}>
                                    <td className="px-12 py-3 text-sm font-medium text-[#1f2328]">{product.label}</td>
                                    <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatDecimalQuantity(product.requests)}</td>
                                    {hasAicGross && (
                                      <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(product.aicGrossAmount)}</td>
                                    )}
                                    {showCosts && (
                                      <>
                                        <td className="px-5 py-3 text-sm text-[#636c76] text-right font-mono tabular-nums">{formatCurrency(product.gross)}</td>
                                        <td className="px-5 py-3 text-sm text-emerald-600 text-right font-mono tabular-nums">-{formatCurrency(product.discount)}</td>
                                        <td className="px-5 py-3 text-sm font-semibold text-[#1f2328] text-right font-mono tabular-nums">{formatCurrency(product.net)}</td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
