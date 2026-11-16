'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRightIcon, CopyIcon, SearchIcon } from '@primer/octicons-react';
import { FormControl, TextInput } from '@primer/react';

import { DailyConsumptionChart } from '@/components/charts/DailyConsumptionChart';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { selectBillingGroupDetails } from '@/utils/ingestion/DetailPagesAggregator';
import type { DetailArtifacts } from '@/utils/ingestion/DetailAggregator';
import { ModelDailyStackedChart } from '@/components/charts/ModelDailyStackedChart';
import { paginateRows, TablePagination } from '@/components/primitives/TablePagination';
import { dataVizColor } from '@/constants/primerTokens';
import type { BillingCostLabels } from '@/utils/billingLabels';
import { buildBillingMonthDates } from '@/utils/dateKeys';
import { selectDetailTimeline } from '@/utils/ingestion/DetailAggregator';
import { formatCurrency, formatDecimalQuantity, formatUtcDateLabel } from '@/utils/formatters';
import type { ProductCategory } from '@/utils/productClassification';

const PRODUCT_CATEGORY_COLORS: Record<ProductCategory, string> = {
  'Copilot': dataVizColor('blue'),
  'Spark': dataVizColor('yellow'),
  'Coding Agent': dataVizColor('teal'),
  'Code Review': dataVizColor('purple'),
  'Code Quality': dataVizColor('green'),
};
interface BillingGroupDailyChartDatum {
  date: string;
  totalCredits: number;
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
  groupKind: 'organization' | 'costCenter';
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
  hasAicGross: boolean;
  /** Renders a searchable per-user spend table for the group. */
  showUsers?: boolean;
  onBack: () => void;
}

export function BillingGroupDetailsView(props: BillingGroupDetailsViewProps) {
  const { detailPagesArtifacts, reportMonth } = useAnalysisContext();
  const data = useMemo(() => selectBillingGroupDetails(detailPagesArtifacts, props.groupKind, props.groupName),
    [detailPagesArtifacts, props.groupKind, props.groupName]);
  return <BillingGroupDetailsContent {...props} data={data} reportMonth={reportMonth} />;
}

export function BillingGroupDetailsContent({
  groupName,
  groupLabel,
  groupsLabel,
  detailIdPrefix,
  data,
  reportMonth,
  quantityColumnLabel,
  costLabels,
  hasAicGross,
  showUsers = false,
  onBack,
}: BillingGroupDetailsViewProps & { data: { details: DetailArtifacts }; reportMonth?: string }) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(0);

  const { details } = data;
  const { productCosts, dailyRows, totals } = details;
  const dailyConsumption = useMemo(
    () => selectDetailTimeline(details, reportMonth).dailyConsumption,
    [details, reportMonth]
  );
  const userCount = details.userRows.length;
  const userRows = useMemo(() => showUsers ? details.userRows : [], [showUsers, details.userRows]);

  const filteredUserRows = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    return query === '' ? userRows : userRows.filter((row) => row.user.toLowerCase().includes(query));
  }, [userRows, userSearch]);
  const { pageItems: paginatedUserRows, activePage: activeUserPage } = useMemo(
    () => paginateRows(filteredUserRows, userPage),
    [filteredUserRows, userPage]
  );

  const productLabels = useMemo(() => productCosts.map((product) => product.label), [productCosts]);
  const productColors = useMemo(() => Object.fromEntries(
    productCosts.map((product) => [product.label, PRODUCT_CATEGORY_COLORS[product.category]])
  ), [productCosts]);

  const chartData = useMemo((): BillingGroupDailyChartDatum[] => {
    const byDate = new Map(dailyRows.map(row => [row.date, row]));
    return buildBillingMonthDates(reportMonth).map(date => {
      const row = byDate.get(date);
      const datum: BillingGroupDailyChartDatum = { date, totalCredits: row?.quantity ?? 0 };

      for (const label of productLabels) {
        datum[label] = 0;
      }
      for (const product of row?.products ?? []) {
        datum[product.label] = product.credits;
      }

      return datum;
    });
  }, [dailyRows, reportMonth, productLabels]);

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
                className="text-2xl font-semibold tracking-tight text-(--fgColor-accent) hover:underline rounded-sm"
              >
                {groupsLabel}
              </button>
            </li>
            <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-(--fgColor-muted)">/</li>
            <li>
              <button
                type="button"
                onClick={handleCopyGroupName}
                title={`Click to copy ${groupLabel}`}
                className="text-2xl font-semibold tracking-tight text-(--fgColor-default) hover:text-(--fgColor-accent) transition-colors duration-150 rounded-sm inline-flex items-center gap-2 group"
              >
                {groupName}
                <CopyIcon
                  size={16}
                  className="text-(--fgColor-muted) group-hover:text-(--fgColor-accent) transition-colors duration-150"
                />
              </button>
            </li>
          </ol>
        </nav>

        <p className="text-sm text-(--fgColor-muted) mt-1">
          {userCount} {userCount === 1 ? 'user' : 'users'}
        </p>
      </div>

      <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
        <table className="min-w-full" aria-label="Summary">
          <thead>
            <tr className="border-b border-(--borderColor-default)">
              <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{quantityColumnLabel}</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.gross}</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.discountSummary}</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.netSummary}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-5 py-3 text-sm font-semibold text-(--fgColor-default) font-mono tabular-nums">{formatDecimalQuantity(totals.quantity)}</td>
              <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(totals.gross)}</td>
              <td className="px-5 py-3 text-sm text-(--fgColor-success) text-right font-mono tabular-nums">-{formatCurrency(totals.discount)}</td>
              <td className="px-5 py-3 text-sm font-semibold text-(--fgColor-default) text-right font-mono tabular-nums">{formatCurrency(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {dailyConsumption.length > 0 && (
        <section aria-labelledby={`${detailIdPrefix}-usd-consumption-title`} className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden min-h-[20rem]">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 id={`${detailIdPrefix}-usd-consumption-title`} className="text-sm font-medium text-(--fgColor-default)">Daily Consumption (USD)</h3>
            <p className="text-xs text-(--fgColor-muted) mt-1">Included and additional usage by day in USD</p>
          </div>
          <div className="p-5">
            <div className="h-72 sm:h-96 2xl:h-[28rem] w-full">
              <DailyConsumptionChart data={dailyConsumption} />
            </div>
          </div>
        </section>
      )}

      <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-(--borderColor-default)">
          <h3 className="text-sm font-medium text-(--fgColor-default)">Spend per Product</h3>
          <p className="text-xs text-(--fgColor-muted) mt-0.5">
            AI credit consumption attributed to this {groupLabel}.
          </p>
        </div>
        {productCosts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Spend per product">
              <thead>
                <tr className="border-b border-(--borderColor-default)">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">Product</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{quantityColumnLabel}</th>
                  {hasAicGross && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">AI Credits Gross</th>
                  )}
                  {showCosts && (
                    <>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.gross}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.discount}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.net}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-(--borderColor-default)">
                {productCosts.map((product) => (
                  <tr key={product.label} className="hover:bg-(--bgColor-muted) transition-colors duration-150">
                    <td className="px-5 py-3 text-sm font-medium text-(--fgColor-default)">{product.label}</td>
                    <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatDecimalQuantity(product.credits)}</td>
                    {hasAicGross && (
                      <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(product.aicGrossAmount)}</td>
                    )}
                    {showCosts && (
                      <>
                        <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(product.gross)}</td>
                        <td className="px-5 py-3 text-sm text-(--fgColor-success) text-right font-mono tabular-nums">-{formatCurrency(product.discount)}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-(--fgColor-default) text-right font-mono tabular-nums">{formatCurrency(product.net)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-(--fgColor-muted) text-sm">
            No data available
          </div>
        )}
      </div>

      {showUsers && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default) flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-(--fgColor-default)">Users</h3>
              <p className="text-xs text-(--fgColor-muted) mt-0.5">
                Showing {filteredUserRows.length} of {userRows.length} {userRows.length === 1 ? 'user' : 'users'} in this {groupLabel}.
              </p>
            </div>
            <FormControl>
              <FormControl.Label visuallyHidden>Search users</FormControl.Label>
              <TextInput
                block
                leadingVisual={SearchIcon}
                value={userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value);
                  setUserPage(0);
                }}
                placeholder="Filter by username..."
                className="min-w-56"
              />
            </FormControl>
          </div>
          {filteredUserRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full" aria-label="Users">
                <thead>
                  <tr className="border-b border-(--borderColor-default)">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">User</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{quantityColumnLabel}</th>
                    {hasAicGross && (
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">AI Credits Gross</th>
                    )}
                    {showCosts && (
                      <>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.gross}</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.discount}</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.net}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--borderColor-default)">
                  {paginatedUserRows.map((row) => (
                    <tr key={row.user} className="hover:bg-(--bgColor-muted) transition-colors duration-150">
                      <td className="px-5 py-3 text-sm font-medium text-(--fgColor-default)">{row.user}</td>
                      <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatDecimalQuantity(row.quantity)}</td>
                      {hasAicGross && (
                        <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(row.aicGrossAmount)}</td>
                      )}
                      {showCosts && (
                        <>
                          <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(row.gross)}</td>
                          <td className="px-5 py-3 text-sm text-(--fgColor-success) text-right font-mono tabular-nums">-{formatCurrency(row.discount)}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-(--fgColor-default) text-right font-mono tabular-nums">{formatCurrency(row.net)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                ariaLabel="Users pagination"
                currentPage={activeUserPage}
                itemCount={filteredUserRows.length}
                onPageChange={setUserPage}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-(--fgColor-muted) text-sm">
              {userRows.length === 0 ? 'No data available' : `No users match "${userSearch}"`}
            </div>
          )}
        </div>
      )}

      <section aria-labelledby="daily-product-consumption-title" className="overflow-hidden rounded-md border border-(--borderColor-default) bg-(--bgColor-default)">
        <div className="border-b border-(--borderColor-default) px-5 py-4">
          <h3 id="daily-product-consumption-title" className="text-sm font-medium text-(--fgColor-default)">Daily Consumption</h3>
          <p className="mt-1 text-xs text-(--fgColor-muted)">Daily {quantityColumnLabel.toLowerCase()} stacked by product.</p>
        </div>
        <div className="p-5">
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
            <div className="flex h-64 items-center justify-center text-sm text-(--fgColor-muted)">
              No data available
            </div>
          )}
        </div>
      </section>

      {dailyRows.length > 0 && (
        <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-(--borderColor-default)">
            <h3 className="text-sm font-medium text-(--fgColor-default)">Daily Consumption Breakdown</h3>
            <p className="text-xs text-(--fgColor-muted) mt-0.5">Expand a day to view consumption by product.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full" aria-label="Daily consumption breakdown">
              <thead>
                <tr className="border-b border-(--borderColor-default)">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{quantityColumnLabel}</th>
                  {hasAicGross && (
                    <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">AI Credits Gross</th>
                  )}
                  {showCosts && (
                    <>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.gross}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.discount}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">{costLabels.net}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-(--borderColor-default)">
                {dailyRows.map((row, index) => {
                  const isExpanded = expandedDate === row.date;
                  const detailsId = `${detailIdPrefix}-${index}`;

                  return (
                    <React.Fragment key={row.date}>
                      <tr className="hover:bg-(--bgColor-muted) transition-colors duration-150">
                        <td className="px-5 py-3.5 text-sm font-medium text-(--fgColor-default)">
                          {row.products.length > 0 ? (
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 text-left"
                              aria-expanded={isExpanded}
                              aria-controls={detailsId}
                              onClick={() => setExpandedDate(isExpanded ? null : row.date)}
                            >
                              <ChevronRightIcon
                                size={16}
                                className={`shrink-0 text-(--fgColor-muted) transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                              />
                              {formatUtcDateLabel(row.date)}
                            </button>
                          ) : (
                            <span className="flex items-center gap-3 pl-7">{formatUtcDateLabel(row.date)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-(--fgColor-default) text-right font-mono tabular-nums">
                          {formatDecimalQuantity(row.quantity)}
                        </td>
                        {hasAicGross && (
                          <td className="px-5 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(row.aicGrossAmount)}</td>
                        )}
                        {showCosts && (
                          <>
                            <td className="px-5 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(row.gross)}</td>
                            <td className="px-5 py-3.5 text-sm text-(--fgColor-success) text-right font-mono tabular-nums">-{formatCurrency(row.discount)}</td>
                            <td className="px-5 py-3.5 text-sm font-semibold text-(--fgColor-default) text-right font-mono tabular-nums">{formatCurrency(row.net)}</td>
                          </>
                        )}
                      </tr>
                      {isExpanded && row.products.length > 0 && (
                        <tr>
                          <td id={detailsId} colSpan={detailColSpan} className="p-0">
                            <table className="min-w-full bg-(--bgColor-muted)" aria-label={`${formatUtcDateLabel(row.date)} product consumption`}>
                              <thead>
                                <tr className="border-y border-(--borderColor-default)">
                                  <th className="px-12 py-2.5 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider">Product</th>
                                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider">{quantityColumnLabel}</th>
                                  {hasAicGross && (
                                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider">AI Credits Gross</th>
                                  )}
                                  {showCosts && (
                                    <>
                                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.gross}</th>
                                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.discount}</th>
                                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider">{costLabels.net}</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-(--borderColor-default)">
                                {row.products.map((product) => (
                                  <tr key={product.label}>
                                    <td className="px-12 py-3 text-sm font-medium text-(--fgColor-default)">{product.label}</td>
                                    <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatDecimalQuantity(product.credits)}</td>
                                    {hasAicGross && (
                                      <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(product.aicGrossAmount)}</td>
                                    )}
                                    {showCosts && (
                                      <>
                                        <td className="px-5 py-3 text-sm text-(--fgColor-muted) text-right font-mono tabular-nums">{formatCurrency(product.gross)}</td>
                                        <td className="px-5 py-3 text-sm text-(--fgColor-success) text-right font-mono tabular-nums">-{formatCurrency(product.discount)}</td>
                                        <td className="px-5 py-3 text-sm font-semibold text-(--fgColor-default) text-right font-mono tabular-nums">{formatCurrency(product.net)}</td>
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
