'use client';

import React, { useMemo, useState } from 'react';

import { useAnalysisContext } from '@/context/AnalysisContext';
import {
  accumulateProductCost,
  createEmptyProductCostMap,
  getPopulatedProductCosts,
  ProductCost,
} from '@/utils/productCosts';

interface CostCenterRow {
  name: string;
  requests: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
  products: ProductCost[];
}

export function CostCentersOverview() {
  const { aggregateProcessedData, billingArtifacts } = useAnalysisContext();
  const [expandedCenter, setExpandedCenter] = useState<string | null>(null);

  const costCenterRows = useMemo((): CostCenterRow[] => {
    const map = new Map<string, {
      requests: number;
      productBuckets: ReturnType<typeof createEmptyProductCostMap>;
    }>();

    for (const row of aggregateProcessedData) {
      const cc = row.costCenter || 'Unassigned';
      let entry = map.get(cc);
      if (!entry) {
        entry = {
          requests: 0,
          productBuckets: createEmptyProductCostMap(),
        };
        map.set(cc, entry);
      }

      entry.requests += row.requestsUsed;
      accumulateProductCost(entry.productBuckets, row);
    }

    return Array.from(map.entries())
      .map(([name, data]) => {
        const totals = billingArtifacts?.costCenterTotals.get(name);

        return {
          name,
          requests: data.requests,
          gross: totals?.gross ?? 0,
          discount: totals?.discount ?? 0,
          net: totals?.net ?? 0,
          aicGrossAmount: totals?.aicGrossAmount ?? 0,
          products: getPopulatedProductCosts(data.productBuckets),
        };
      })
      .sort((a, b) => b.net - a.net);
  }, [aggregateProcessedData, billingArtifacts]);

  const hasCosts = costCenterRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = billingArtifacts?.hasAnyAicData === true;
  const detailColSpan = 2 + (hasAicGross ? 1 : 0) + (hasCosts ? 3 : 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
          <h3 className="text-lg font-semibold text-[#1f2328]">Cost Centers</h3>
          <p className="text-xs text-[#636c76] mt-1">{costCenterRows.length} cost center{costCenterRows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#d1d9e0]">
                <th className="px-6 py-3 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">Cost Center</th>
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
              {costCenterRows.map((cc, index) => {
                const detailsId = `cost-center-details-${index}`;

                return (
                <React.Fragment key={cc.name}>
                  <tr className="table-row-hover transition-colors duration-150">
                    <td className="px-6 py-3.5 text-sm font-medium text-[#1f2328]">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left w-full"
                        aria-expanded={expandedCenter === cc.name}
                        aria-controls={detailsId}
                        onClick={() => setExpandedCenter(expandedCenter === cc.name ? null : cc.name)}
                      >
                        <svg
                          className={`w-3.5 h-3.5 text-[#636c76] transition-transform duration-150 ${expandedCenter === cc.name ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        {cc.name}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                      {cc.requests.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {hasAicGross && (
                      <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                        ${cc.aicGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {hasCosts && (
                      <>
                        <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                          ${cc.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-emerald-600 text-right font-mono">
                          -${cc.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-semibold text-[#1f2328] text-right font-mono">
                          ${cc.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                  </tr>
                  {expandedCenter === cc.name && cc.products.length > 0 && (
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
                              {cc.products.map((p) => (
                                <tr key={p.label}>
                                  <td className="px-10 py-2.5 text-sm text-[#636c76]">{p.label}</td>
                                  <td className="px-6 py-2.5 text-sm text-[#636c76] text-right font-mono">
                                    {p.requests.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  {hasAicGross && (
                                    <td className="px-6 py-2.5 text-sm text-[#636c76] text-right font-mono">
                                      ${p.aicGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  )}
                                  {hasCosts && (
                                    <>
                                      <td className="px-6 py-2.5 text-sm text-[#636c76] text-right font-mono">
                                        ${p.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-6 py-2.5 text-sm text-emerald-600 text-right font-mono">
                                        -${p.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-6 py-2.5 text-sm font-semibold text-[#1f2328] text-right font-mono">
                                        ${p.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
