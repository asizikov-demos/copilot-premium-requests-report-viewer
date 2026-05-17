'use client';

import React, { useMemo, useState } from 'react';

import type { ProcessedData } from '@/types/csv';
import type { BillingGroupTotals } from '@/utils/ingestion';
import {
  accumulateProductCost,
  createEmptyProductCostMap,
  getPopulatedProductCosts,
  ProductCost,
} from '@/utils/productCosts';

export interface BillingGroupRow {
  name: string;
  requests: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
  products: ProductCost[];
}

export interface BillingGroupEntry {
  requests: number;
  productBuckets: ReturnType<typeof createEmptyProductCostMap>;
  users?: Set<string>;
}

interface UseBillingGroupRowsBaseOptions {
  sourceRows: ProcessedData[];
  getGroupName: (row: ProcessedData) => string;
  getTotals: (name: string) => BillingGroupTotals | undefined;
  updateEntry?: (entry: BillingGroupEntry, row: ProcessedData) => void;
}

interface UseBillingGroupRowsWithExtrasOptions<TExtra extends object> extends UseBillingGroupRowsBaseOptions {
  getExtraFields: (entry: BillingGroupEntry) => TExtra;
}

export function useBillingGroupRows(options: UseBillingGroupRowsBaseOptions): BillingGroupRow[];
export function useBillingGroupRows<TExtra extends object>(options: UseBillingGroupRowsWithExtrasOptions<TExtra>): Array<BillingGroupRow & TExtra>;
export function useBillingGroupRows<TExtra extends object>(
  options: UseBillingGroupRowsBaseOptions | UseBillingGroupRowsWithExtrasOptions<TExtra>
): Array<BillingGroupRow | (BillingGroupRow & TExtra)> {
  const {
    sourceRows,
    getGroupName,
    getTotals,
    updateEntry,
  } = options;
  const getExtraFields = 'getExtraFields' in options ? options.getExtraFields : undefined;

  return useMemo(() => {
    const map = new Map<string, BillingGroupEntry>();

    for (const row of sourceRows) {
      const groupName = getGroupName(row);
      let entry = map.get(groupName);
      if (!entry) {
        entry = {
          requests: 0,
          productBuckets: createEmptyProductCostMap(),
        };
        map.set(groupName, entry);
      }

      updateEntry?.(entry, row);
      entry.requests += row.requestsUsed;
      accumulateProductCost(entry.productBuckets, row);
    }

    return Array.from(map.entries())
      .map(([name, data]) => {
        const totals = getTotals(name);

        const baseRow: BillingGroupRow = {
          name,
          requests: data.requests,
          gross: totals?.gross ?? 0,
          discount: totals?.discount ?? 0,
          net: totals?.net ?? 0,
          aicGrossAmount: totals?.aicGrossAmount ?? 0,
          products: getPopulatedProductCosts(data.productBuckets),
        };

        return getExtraFields ? { ...baseRow, ...getExtraFields(data) } : baseRow;
      })
      .sort((a, b) => b.net - a.net);
  }, [sourceRows, getGroupName, getTotals, updateEntry, getExtraFields]);
}

interface BillingGroupExtraColumn<T extends BillingGroupRow> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface BillingGroupTableProps<T extends BillingGroupRow> {
  title: string;
  singularLabel: string;
  nameColumnLabel: string;
  rows: T[];
  hasCosts: boolean;
  hasAicGross: boolean;
  detailIdPrefix: string;
  extraColumns?: Array<BillingGroupExtraColumn<T>>;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BillingGroupTable<T extends BillingGroupRow>({
  title,
  singularLabel,
  nameColumnLabel,
  rows,
  hasCosts,
  hasAicGross,
  detailIdPrefix,
  extraColumns = [],
}: BillingGroupTableProps<T>) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const detailColSpan = 2 + extraColumns.length + (hasAicGross ? 1 : 0) + (hasCosts ? 3 : 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
          <h3 className="text-lg font-semibold text-[#1f2328]">{title}</h3>
          <p className="text-xs text-[#636c76] mt-1">{rows.length} {singularLabel}{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#d1d9e0]">
                <th className="px-6 py-3 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">{nameColumnLabel}</th>
                {extraColumns.map((column) => (
                  <th key={column.key} className={column.headerClassName ?? 'px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider'}>
                    {column.header}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Requests</th>
                {hasAicGross && (
                  <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">AI Credits Gross</th>
                )}
                {hasCosts && (
                  <>
                    <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Gross</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Discount</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Net</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d1d9e0]">
              {rows.map((row, index) => {
                const detailsId = `${detailIdPrefix}-${index}`;
                const isExpanded = expandedGroup === row.name;

                return (
                  <React.Fragment key={row.name}>
                    <tr className="table-row-hover transition-colors duration-150">
                      <td className="px-6 py-3.5 text-sm font-medium text-[#1f2328]">
                        {row.products.length > 0 ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left w-full"
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() => setExpandedGroup(isExpanded ? null : row.name)}
                          >
                            <svg
                              className={`w-3.5 h-3.5 text-[#636c76] transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            {row.name}
                          </button>
                        ) : (
                          <span>{row.name}</span>
                        )}
                      </td>
                      {extraColumns.map((column) => (
                        <td key={column.key} className={column.cellClassName ?? 'px-6 py-3.5 text-sm text-[#636c76] text-right font-mono'}>
                          {column.render(row)}
                        </td>
                      ))}
                      <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                        {formatQuantity(row.requests)}
                      </td>
                      {hasAicGross && (
                        <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                          {formatCurrency(row.aicGrossAmount)}
                        </td>
                      )}
                      {hasCosts && (
                        <>
                          <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                            {formatCurrency(row.gross)}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-emerald-600 text-right font-mono">
                            -{formatCurrency(row.discount)}
                          </td>
                          <td className="px-6 py-3.5 text-sm font-semibold text-[#1f2328] text-right font-mono">
                            {formatCurrency(row.net)}
                          </td>
                        </>
                      )}
                    </tr>
                    {isExpanded && row.products.length > 0 && (
                      <tr>
                        <td id={detailsId} colSpan={detailColSpan} className="px-0 py-0">
                          <div className="bg-[#f6f8fa] border-t border-[#d1d9e0]">
                            <table className="min-w-full">
                              <thead>
                                <tr className="border-b border-[#d1d9e0]">
                                  <th className="px-10 py-2 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">Product</th>
                                  <th className="px-6 py-2 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Requests</th>
                                  {hasAicGross && (
                                    <th className="px-6 py-2 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">AI Credits Gross</th>
                                  )}
                                  {hasCosts && (
                                    <>
                                      <th className="px-6 py-2 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Gross</th>
                                      <th className="px-6 py-2 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Discount</th>
                                      <th className="px-6 py-2 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Net</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#e8ecf0]">
                                {row.products.map((product) => (
                                  <tr key={product.label}>
                                    <td className="px-10 py-2.5 text-sm text-[#636c76]">{product.label}</td>
                                    <td className="px-6 py-2.5 text-sm text-[#636c76] text-right font-mono">
                                      {formatQuantity(product.requests)}
                                    </td>
                                    {hasAicGross && (
                                      <td className="px-6 py-2.5 text-sm text-[#636c76] text-right font-mono">
                                        {formatCurrency(product.aicGrossAmount)}
                                      </td>
                                    )}
                                    {hasCosts && (
                                      <>
                                        <td className="px-6 py-2.5 text-sm text-[#636c76] text-right font-mono">
                                          {formatCurrency(product.gross)}
                                        </td>
                                        <td className="px-6 py-2.5 text-sm text-emerald-600 text-right font-mono">
                                          -{formatCurrency(product.discount)}
                                        </td>
                                        <td className="px-6 py-2.5 text-sm font-semibold text-[#1f2328] text-right font-mono">
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
