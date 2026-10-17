'use client';

import React from 'react';
import { Link } from '@primer/react';

import type { BillingCostLabels } from '@/utils/billingLabels';
import { formatCurrency, formatDecimalQuantity } from '@/utils/formatters';

export interface AgentUsageTableRow {
  user: string;
  quantity: number;
  gross: number;
  included: number;
  additional: number;
}

export function formatUsageQuantity(value: number): string {
  return formatDecimalQuantity(value);
}

export function getVisibleRows<T>(
  rows: T[],
  showAllRows: boolean,
  previewCount: number
): T[] {
  if (showAllRows) {
    return rows;
  }

  return rows.slice(0, previewCount);
}

interface AgentUsersTableProps {
  tableTitle: string;
  rows: AgentUsageTableRow[];
  showCosts: boolean;
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
  showAll: boolean;
  onToggleShowAll: () => void;
  previewCount: number;
}

const headerCellClassName =
  'px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)';

export function AgentUsersTable({
  tableTitle,
  rows,
  showCosts,
  quantityColumnLabel,
  costLabels,
  showAll,
  onToggleShowAll,
  previewCount,
}: AgentUsersTableProps) {
  const visibleRows = getVisibleRows(rows, showAll, previewCount);
  const hasMore = rows.length > previewCount;

  return (
    <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md overflow-hidden">
      <div className="px-5 py-4 border-b border-(--borderColor-default)">
        <h3 className="text-sm font-medium text-(--fgColor-default)">{tableTitle}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-(--borderColor-default)">
              <th className="px-5 py-3 text-left text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)">
                User
              </th>
              <th className={headerCellClassName}>{quantityColumnLabel}</th>
              {showCosts && (
                <>
                  <th className={headerCellClassName}>{costLabels.gross}</th>
                  <th className={headerCellClassName}>{costLabels.discount}</th>
                  <th className={headerCellClassName}>{costLabels.net}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--borderColor-default)">
            {visibleRows.map((user) => (
              <tr key={user.user} className="hover:bg-(--bgColor-muted) transition-colors">
                <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-(--fgColor-default)">
                  {user.user}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-(--fgColor-default) text-right">
                  {formatUsageQuantity(user.quantity)}
                </td>
                {showCosts && (
                  <>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-(--fgColor-muted) text-right">
                      {formatCurrency(user.gross)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-(--fgColor-success) text-right">
                      -{formatCurrency(user.included)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-sm font-mono font-semibold text-(--fgColor-default) text-right">
                      {formatCurrency(user.additional)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="px-5 py-3 border-t border-(--borderColor-default) text-sm">
          <Link as="button" type="button" className="font-medium" onClick={onToggleShowAll}>
            {showAll ? `Show top ${previewCount}` : `Show all ${rows.length} users`}
          </Link>
        </div>
      )}
    </div>
  );
}
