'use client';

import React from 'react';

import type { BillingCostLabels } from '@/utils/billingLabels';
import { formatCurrency } from '@/utils/formatters';

export interface AgentUsageTableRow {
  user: string;
  quantity: number;
  gross: number;
  included: number;
  additional: number;
  quota: number | 'unknown';
  isSyntheticNonCopilotRow?: boolean;
}

export function formatUsageQuantity(value: number, isUsageBasedBilling: boolean): string {
  if (isUsageBasedBilling) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return value.toFixed(1);
}

export function formatQuotaValue(quota: number | 'unknown'): string {
  return quota === 'unknown' ? 'Unknown' : quota.toLocaleString();
}

export function getVisibleRows<T extends { isSyntheticNonCopilotRow?: boolean }>(
  rows: T[],
  showAllRows: boolean,
  previewCount: number
): T[] {
  if (showAllRows) {
    return rows;
  }

  const preview = rows.slice(0, previewCount);
  const syntheticRow = rows.find((row) => row.isSyntheticNonCopilotRow);

  if (!syntheticRow || preview.some((row) => row.isSyntheticNonCopilotRow)) {
    return preview;
  }

  return [...preview.slice(0, Math.max(0, previewCount - 1)), syntheticRow];
}

interface AgentUsersTableProps {
  tableTitle: string;
  rows: AgentUsageTableRow[];
  isUsageBasedBilling: boolean;
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
  showAll: boolean;
  onToggleShowAll: () => void;
  previewCount: number;
}

const headerCellClassName =
  'px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]';

export function AgentUsersTable({
  tableTitle,
  rows,
  isUsageBasedBilling,
  quantityColumnLabel,
  costLabels,
  showAll,
  onToggleShowAll,
  previewCount,
}: AgentUsersTableProps) {
  const visibleRows = getVisibleRows(rows, showAll, previewCount);
  const hasMore = rows.length > previewCount;

  return (
    <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
      <div className="px-5 py-4 border-b border-[#d1d9e0]">
        <h3 className="text-sm font-medium text-[#1f2328]">{tableTitle}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-[#d1d9e0]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">
                User
              </th>
              <th className={headerCellClassName}>{quantityColumnLabel}</th>
              {isUsageBasedBilling ? (
                <>
                  <th className={headerCellClassName}>{costLabels.gross}</th>
                  <th className={headerCellClassName}>{costLabels.discount}</th>
                  <th className={headerCellClassName}>{costLabels.net}</th>
                </>
              ) : (
                <th className={headerCellClassName}>Quota</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d1d9e0]">
            {visibleRows.map((user) => (
              <tr key={user.user} className="hover:bg-[#fcfdff] transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-[#1f2328]">
                  {user.user}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#1f2328] text-right">
                  {formatUsageQuantity(user.quantity, isUsageBasedBilling)}
                </td>
                {isUsageBasedBilling ? (
                  <>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-[#636c76] text-right">
                      {formatCurrency(user.gross)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-emerald-600 text-right">
                      -{formatCurrency(user.included)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-[#1f2328] text-right">
                      {formatCurrency(user.additional)}
                    </td>
                  </>
                ) : (
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-[#636c76] text-right">
                    {formatQuotaValue(user.quota)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="px-5 py-3 border-t border-[#d1d9e0]">
          <button
            onClick={onToggleShowAll}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {showAll ? `Show top ${previewCount}` : `Show all ${rows.length} users`}
          </button>
        </div>
      )}
    </div>
  );
}
