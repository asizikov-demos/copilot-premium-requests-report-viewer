'use client';

import React, { useState } from 'react';

import type { ProductCost } from '@/utils/productCosts';

export interface BillingGroupRow {
  name: string;
  requests: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
  products: ProductCost[];
}

interface BillingGroupExtraColumn<TRow extends BillingGroupRow> {
  header: string;
  render: (row: TRow) => React.ReactNode;
}

interface BillingGroupTableProps<TRow extends BillingGroupRow> {
  title: string;
  countLabel: string;
  primaryHeader: string;
  detailsIdPrefix: string;
  rows: TRow[];
  hasCosts: boolean;
  hasAicGross: boolean;
  extraColumns?: BillingGroupExtraColumn<TRow>[];
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const requestFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return `$${currencyFormatter.format(value)}`;
}

function formatDiscount(value: number): string {
  return `-${formatCurrency(value)}`;
}

function BillingAmountHeaders({ hasCosts, hasAicGross }: { hasCosts: boolean; hasAicGross: boolean }) {
  return (
    <>
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
    </>
  );
}

function BillingAmountCells({
  gross,
  discount,
  net,
  aicGrossAmount,
  hasCosts,
  hasAicGross,
  compact = false,
}: {
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
  hasCosts: boolean;
  hasAicGross: boolean;
  compact?: boolean;
}) {
  const cellPadding = compact ? 'px-6 py-2.5' : 'px-6 py-3.5';

  return (
    <>
      {hasAicGross && (
        <td className={`${cellPadding} text-sm text-[#636c76] text-right font-mono`}>
          {formatCurrency(aicGrossAmount)}
        </td>
      )}
      {hasCosts && (
        <>
          <td className={`${cellPadding} text-sm text-[#636c76] text-right font-mono`}>
            {formatCurrency(gross)}
          </td>
          <td className={`${cellPadding} text-sm text-emerald-600 text-right font-mono`}>
            {formatDiscount(discount)}
          </td>
          <td className={`${cellPadding} text-sm font-semibold text-[#1f2328] text-right font-mono`}>
            {formatCurrency(net)}
          </td>
        </>
      )}
    </>
  );
}

function ProductBreakdown({ products, hasCosts, hasAicGross }: { products: ProductCost[]; hasCosts: boolean; hasAicGross: boolean }) {
  return (
    <div className="bg-[#f6f8fa] border-t border-[#d1d9e0]">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[#d1d9e0]">
            <th className="px-10 py-2 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">Product</th>
            <th className="px-6 py-2 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Requests</th>
            <BillingAmountHeaders hasCosts={hasCosts} hasAicGross={hasAicGross} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e8ecf0]">
          {products.map((product) => (
            <tr key={product.label}>
              <td className="px-10 py-2.5 text-sm text-[#636c76]">{product.label}</td>
              <td className="px-6 py-2.5 text-sm text-[#636c76] text-right font-mono">
                {requestFormatter.format(product.requests)}
              </td>
              <BillingAmountCells
                gross={product.gross}
                discount={product.discount}
                net={product.net}
                aicGrossAmount={product.aicGrossAmount}
                hasCosts={hasCosts}
                hasAicGross={hasAicGross}
                compact
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BillingGroupTable<TRow extends BillingGroupRow>({
  title,
  countLabel,
  primaryHeader,
  detailsIdPrefix,
  rows,
  hasCosts,
  hasAicGross,
  extraColumns = [],
}: BillingGroupTableProps<TRow>) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const detailColSpan = 2 + extraColumns.length + (hasAicGross ? 1 : 0) + (hasCosts ? 3 : 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
          <h3 className="text-lg font-semibold text-[#1f2328]">{title}</h3>
          <p className="text-xs text-[#636c76] mt-1">{rows.length} {countLabel}{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#d1d9e0]">
                <th className="px-6 py-3 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">{primaryHeader}</th>
                {extraColumns.map((column) => (
                  <th key={column.header} className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">{column.header}</th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Requests</th>
                <BillingAmountHeaders hasCosts={hasCosts} hasAicGross={hasAicGross} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d1d9e0]">
              {rows.map((row, index) => {
                const isExpanded = expandedGroup === row.name;
                const detailsId = `${detailsIdPrefix}-${index}`;

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
                        <td key={column.header} className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                          {column.render(row)}
                        </td>
                      ))}
                      <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                        {requestFormatter.format(row.requests)}
                      </td>
                      <BillingAmountCells
                        gross={row.gross}
                        discount={row.discount}
                        net={row.net}
                        aicGrossAmount={row.aicGrossAmount}
                        hasCosts={hasCosts}
                        hasAicGross={hasAicGross}
                      />
                    </tr>
                    {isExpanded && row.products.length > 0 && (
                      <tr>
                        <td id={detailsId} colSpan={detailColSpan} className="px-0 py-0">
                          <ProductBreakdown products={row.products} hasCosts={hasCosts} hasAicGross={hasAicGross} />
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
