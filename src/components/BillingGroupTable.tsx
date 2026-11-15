'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRightIcon } from '@primer/octicons-react';
import { Link } from '@primer/react';

import { buildBillingGroupRows, type BillingGroupTotals, type BillingPageGroup } from '@/utils/ingestion';
import { formatCurrency, formatDecimalQuantity } from '@/utils/formatters';
import {
  ProductCost,
} from '@/utils/productCosts';

export interface BillingGroupRow {
  name: string;
  credits: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
  products: ProductCost[];
}

export function useBillingGroupRows(
  groups: Map<string, BillingPageGroup>,
  billingTotals: Map<string, BillingGroupTotals> | undefined,
): Array<BillingGroupRow & { users: number }> {
  return useMemo(() => buildBillingGroupRows(groups).map(row => {
    const totals = billingTotals?.get(row.name);
    return {
      ...row,
      gross: totals?.gross ?? 0,
      discount: totals?.discount ?? 0,
      net: totals?.net ?? 0,
      aicGrossAmount: totals?.aicGrossAmount ?? 0,
    };
  }).sort((a, b) => b.net - a.net), [groups, billingTotals]);
}

interface BillingGroupExtraColumn<T extends BillingGroupRow> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

/** Trailing "Details" column that links each group row to its drill-down view. */
export function createDetailsColumn<T extends BillingGroupRow>(
  onSelect: (name: string) => void
): BillingGroupExtraColumn<T> {
  return {
    key: 'details',
    header: 'Details',
    render: (row) => (
      <Link as="button" type="button" className="font-medium" onClick={() => onSelect(row.name)}>
        View details
      </Link>
    ),
  };
}

interface BillingGroupTableProps<T extends BillingGroupRow> {
  title: string;
  singularLabel: string;
  nameColumnLabel: string;
  rows: T[];
  hasCosts: boolean;
  hasAicGross: boolean;
  detailIdPrefix: string;
  quantityColumnLabel?: string;
  grossColumnLabel?: string;
  discountColumnLabel?: string;
  netColumnLabel?: string;
  extraColumns?: Array<BillingGroupExtraColumn<T>>;
  endColumns?: Array<BillingGroupExtraColumn<T>>;
}

export function BillingGroupTable<T extends BillingGroupRow>({
  title,
  singularLabel,
  nameColumnLabel,
  rows,
  hasCosts,
  hasAicGross,
  detailIdPrefix,
  quantityColumnLabel = 'AI Credits',
  grossColumnLabel = 'Gross',
  discountColumnLabel = 'Discount',
  netColumnLabel = 'Net',
  extraColumns = [],
  endColumns = [],
}: BillingGroupTableProps<T>) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const detailColSpan = 2 + extraColumns.length + endColumns.length + (hasAicGross ? 1 : 0) + (hasCosts ? 3 : 0);

  return (
    <div className="space-y-6">
      <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="px-6 py-4 border-b border-(--borderColor-default)">
          <h3 className="text-lg font-semibold text-(--fgColor-default)">{title}</h3>
          <p className="text-xs text-(--fgColor-muted) mt-1">{rows.length} {singularLabel}{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-(--borderColor-default)">
                <th className="px-6 py-3 text-left text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{nameColumnLabel}</th>
                {extraColumns.map((column) => (
                  <th key={column.key} className={column.headerClassName ?? 'px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider'}>
                    {column.header}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{quantityColumnLabel}</th>
                {hasAicGross && (
                  <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">AI Credits Gross</th>
                )}
                {hasCosts && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{grossColumnLabel}</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{discountColumnLabel}</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{netColumnLabel}</th>
                  </>
                )}
                {endColumns.map((column) => (
                  <th key={column.key} className={column.headerClassName ?? 'px-6 py-3 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider'}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--borderColor-default)">
              {rows.map((row, index) => {
                const detailsId = `${detailIdPrefix}-${index}`;
                const isExpanded = expandedGroup === row.name;

                return (
                  <React.Fragment key={row.name}>
                    <tr className="hover:bg-(--bgColor-muted) transition-colors duration-150">
                      <td className="px-6 py-3.5 text-sm font-medium text-(--fgColor-default)">
                        {row.products.length > 0 ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left w-full"
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() => setExpandedGroup(isExpanded ? null : row.name)}
                          >
                            <ChevronRightIcon
                              size={16}
                              className={`shrink-0 text-(--fgColor-muted) transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                            />
                            {row.name}
                          </button>
                        ) : (
                          <span>{row.name}</span>
                        )}
                      </td>
                      {extraColumns.map((column) => (
                        <td key={column.key} className={column.cellClassName ?? 'px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono'}>
                          {column.render(row)}
                        </td>
                      ))}
                      <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">
                        {formatDecimalQuantity(row.credits)}
                      </td>
                      {hasAicGross && (
                        <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">
                          {formatCurrency(row.aicGrossAmount)}
                        </td>
                      )}
                      {hasCosts && (
                        <>
                          <td className="px-6 py-3.5 text-sm text-(--fgColor-muted) text-right font-mono">
                            {formatCurrency(row.gross)}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-(--fgColor-success) text-right font-mono">
                            -{formatCurrency(row.discount)}
                          </td>
                          <td className="px-6 py-3.5 text-sm font-semibold text-(--fgColor-default) text-right font-mono">
                            {formatCurrency(row.net)}
                          </td>
                        </>
                      )}
                      {endColumns.map((column) => (
                        <td key={column.key} className={column.cellClassName ?? 'px-6 py-3.5 text-sm text-right'}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && row.products.length > 0 && (
                      <tr>
                        <td id={detailsId} colSpan={detailColSpan} className="px-0 py-0">
                          <div className="bg-(--bgColor-muted) border-t border-(--borderColor-default)">
                            <table className="min-w-full">
                              <thead>
                                <tr className="border-b border-(--borderColor-default)">
                                  <th className="px-10 py-2 text-left text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">Product</th>
                                  <th className="px-6 py-2 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{quantityColumnLabel}</th>
                                  {hasAicGross && (
                                    <th className="px-6 py-2 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">AI Credits Gross</th>
                                  )}
                                  {hasCosts && (
                                    <>
                                      <th className="px-6 py-2 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{grossColumnLabel}</th>
                                      <th className="px-6 py-2 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{discountColumnLabel}</th>
                                      <th className="px-6 py-2 text-right text-xs font-bold text-(--fgColor-muted) uppercase tracking-wider">{netColumnLabel}</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-(--borderColor-muted)">
                                {row.products.map((product) => (
                                  <tr key={product.label}>
                                    <td className="px-10 py-2.5 text-sm text-(--fgColor-muted)">{product.label}</td>
                                    <td className="px-6 py-2.5 text-sm text-(--fgColor-muted) text-right font-mono">
                                      {formatDecimalQuantity(product.credits)}
                                    </td>
                                    {hasAicGross && (
                                      <td className="px-6 py-2.5 text-sm text-(--fgColor-muted) text-right font-mono">
                                        {formatCurrency(product.aicGrossAmount)}
                                      </td>
                                    )}
                                    {hasCosts && (
                                      <>
                                        <td className="px-6 py-2.5 text-sm text-(--fgColor-muted) text-right font-mono">
                                          {formatCurrency(product.gross)}
                                        </td>
                                        <td className="px-6 py-2.5 text-sm text-(--fgColor-success) text-right font-mono">
                                          -{formatCurrency(product.discount)}
                                        </td>
                                        <td className="px-6 py-2.5 text-sm font-semibold text-(--fgColor-default) text-right font-mono">
                                          {formatCurrency(product.net)}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
    </div>
  );
}
