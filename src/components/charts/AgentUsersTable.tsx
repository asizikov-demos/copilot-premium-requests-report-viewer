'use client';

import React from 'react';

import { DEFAULT_TABLE_PAGE_SIZE, TablePagination } from '@/components/primitives/TablePagination';
import type { BillingCostLabels } from '@/utils/billingLabels';
import { formatCurrency, formatDecimalQuantity } from '@/utils/formatters';

export interface AgentUsageTableRow {
  user: string;
  quantity: number;
  gross: number;
  included: number;
  additional: number;
}

interface AgentUsersTableProps {
  tableTitle: string;
  rows: AgentUsageTableRow[];
  showCosts: boolean;
  quantityColumnLabel: string;
  costLabels: BillingCostLabels;
}

const headerCellClassName =
  'px-5 py-3 text-right text-xs font-semibold text-(--fgColor-muted) uppercase tracking-wider bg-(--bgColor-muted)';

export function AgentUsersTable({
  tableTitle,
  rows,
  showCosts,
  quantityColumnLabel,
  costLabels,
}: AgentUsersTableProps) {
  const [paginationState, setPaginationState] = React.useState({ rows, page: 0 });
  const currentPage = paginationState.rows === rows ? paginationState.page : 0;
  const pageCount = Math.ceil(rows.length / DEFAULT_TABLE_PAGE_SIZE);
  const activePage = Math.min(currentPage, Math.max(pageCount - 1, 0));
  const visibleRows = rows.slice(
    activePage * DEFAULT_TABLE_PAGE_SIZE,
    (activePage + 1) * DEFAULT_TABLE_PAGE_SIZE
  );

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
                  {formatDecimalQuantity(user.quantity)}
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
      <TablePagination
        ariaLabel={`${tableTitle} pagination`}
        currentPage={activePage}
        itemCount={rows.length}
        onPageChange={(page) => setPaginationState({ rows, page })}
      />
    </div>
  );
}
