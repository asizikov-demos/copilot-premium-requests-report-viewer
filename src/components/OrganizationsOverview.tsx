'use client';

import React, { useMemo, useState } from 'react';
import { useAnalysisContext } from '@/context/AnalysisContext';
import { hasAicFields } from '@/utils/aicFields';
import {
  accumulateProductCost,
  createEmptyProductCostMap,
  getPopulatedProductCosts,
  ProductCost,
} from '@/utils/productCosts';

interface OrganizationRow {
  name: string;
  users: number;
  requests: number;
  gross: number;
  discount: number;
  net: number;
  aicGrossAmount: number;
  products: ProductCost[];
}

export function OrganizationsOverview() {
  const { aggregateProcessedData } = useAnalysisContext();
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  const orgRows = useMemo((): OrganizationRow[] => {
    const map = new Map<string, {
      userSet: Set<string>;
      requests: number;
      gross: number;
      discount: number;
      net: number;
      aicGrossAmount: number;
      productBuckets: ReturnType<typeof createEmptyProductCostMap>;
    }>();

    for (const row of aggregateProcessedData) {
      const org = row.organization || 'Unassigned';
      let entry = map.get(org);
      if (!entry) {
        entry = {
          userSet: new Set(),
          requests: 0,
          gross: 0,
          discount: 0,
          net: 0,
          aicGrossAmount: 0,
          productBuckets: createEmptyProductCostMap(),
        };
        map.set(org, entry);
      }

      if (!row.isNonCopilotUsage) {
        entry.userSet.add(row.user);
      }
      entry.requests += row.requestsUsed;
      entry.gross += row.grossAmount ?? 0;
      entry.discount += row.discountAmount ?? 0;
      entry.net += row.netAmount ?? 0;
      entry.aicGrossAmount += row.aicGrossAmount ?? 0;
      accumulateProductCost(entry.productBuckets, row);
    }

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        users: data.userSet.size,
        requests: data.requests,
        gross: data.gross,
        discount: data.discount,
        net: data.net,
        aicGrossAmount: data.aicGrossAmount,
        products: getPopulatedProductCosts(data.productBuckets),
      }))
      .sort((a, b) => b.net - a.net);
  }, [aggregateProcessedData]);

  const hasCosts = orgRows.some(r => r.gross > 0 || r.net > 0);
  const hasAicGross = hasAicFields(aggregateProcessedData);
  const detailColSpan = 3 + (hasAicGross ? 1 : 0) + (hasCosts ? 3 : 0);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="px-6 py-4 border-b border-[#d1d9e0] bg-[#f6f8fa]">
          <h3 className="text-lg font-semibold text-[#1f2328]">Organizations</h3>
          <p className="text-xs text-[#636c76] mt-1">{orgRows.length} organization{orgRows.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#d1d9e0]">
                <th className="px-6 py-3 text-left text-xs font-bold text-[#636c76] uppercase tracking-wider">Organization</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-[#636c76] uppercase tracking-wider">Users</th>
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
              {orgRows.map((org, index) => {
                const detailsId = `organization-details-${index}`;

                return (
                <React.Fragment key={org.name}>
                  <tr className="table-row-hover transition-colors duration-150">
                    <td className="px-6 py-3.5 text-sm font-medium text-[#1f2328]">
                      {org.products.length > 0 ? (
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left w-full"
                          aria-expanded={expandedOrg === org.name}
                          aria-controls={detailsId}
                          onClick={() => setExpandedOrg(expandedOrg === org.name ? null : org.name)}
                        >
                          <svg
                            className={`w-3.5 h-3.5 text-[#636c76] transition-transform duration-150 ${expandedOrg === org.name ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {org.name}
                        </button>
                      ) : (
                        <span>{org.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                      {org.users.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                      {org.requests.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {hasAicGross && (
                      <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                        ${org.aicGrossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    {hasCosts && (
                      <>
                        <td className="px-6 py-3.5 text-sm text-[#636c76] text-right font-mono">
                          ${org.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-emerald-600 text-right font-mono">
                          -${org.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-semibold text-[#1f2328] text-right font-mono">
                          ${org.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                  </tr>
                  {expandedOrg === org.name && org.products.length > 0 && (
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
                              {org.products.map((p) => (
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
