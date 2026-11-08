'use client';

import { useState } from 'react';
import { SearchIcon } from '@primer/octicons-react';
import { FormControl, TextInput } from '@primer/react';

import { DEFAULT_TABLE_PAGE_SIZE, TablePagination } from '@/components/primitives/TablePagination';
import type { UserConsumptionCategory } from '@/utils/analytics/insights';
import { formatDecimalQuantity } from '@/utils/formatters';

interface UserCategoryTableProps {
  users: UserConsumptionCategory[];
}

export function UserCategoryTable({ users }: UserCategoryTableProps) {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const matchingUsers = users.filter(user => user.user.toLowerCase().includes(query.trim().toLowerCase()));
  const pageCount = Math.ceil(matchingUsers.length / DEFAULT_TABLE_PAGE_SIZE);
  const activePage = Math.min(currentPage, Math.max(pageCount - 1, 0));
  const visibleUsers = matchingUsers.slice(
    activePage * DEFAULT_TABLE_PAGE_SIZE,
    (activePage + 1) * DEFAULT_TABLE_PAGE_SIZE
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <FormControl className="max-w-full">
          <FormControl.Label visuallyHidden>Search users in this group</FormControl.Label>
          <TextInput type="search" leadingVisual={SearchIcon} value={query} onChange={event => { setQuery(event.target.value); setCurrentPage(0); }} placeholder="Find a user..." className="w-56 max-w-full" />
        </FormControl>
        <span className="text-xs text-(--fgColor-muted)" role="status">{matchingUsers.length} matching {matchingUsers.length === 1 ? 'user' : 'users'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-y border-(--borderColor-default) bg-(--bgColor-muted) text-xs uppercase tracking-wider text-(--fgColor-muted)">
            <tr><th scope="col" className="px-5 py-3 text-left">User</th><th scope="col" className="px-5 py-3 text-right">AI Credits</th><th scope="col" className="px-5 py-3 text-right">Included quota</th><th scope="col" className="px-5 py-3 text-right">Used</th></tr>
          </thead>
          <tbody className="divide-y divide-(--borderColor-default)">
            {visibleUsers.map(user => (
              <tr key={user.user} className="hover:bg-(--bgColor-muted)">
                <td className="px-5 py-3 font-medium text-(--fgColor-default)">{user.user}</td>
                <td className="px-5 py-3 text-right font-mono text-xs text-(--fgColor-muted)">{formatDecimalQuantity(user.totalCredits)}</td>
                <td className="px-5 py-3 text-right font-mono text-xs text-(--fgColor-muted)">{user.quota === 'unknown' ? 'Unknown' : user.quota.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono text-xs text-(--fgColor-muted)">{user.quota === 'unknown' ? 'Unknown' : `${user.consumptionPercentage.toFixed(1)}%`}</td>
              </tr>
            ))}
            {visibleUsers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-(--fgColor-muted)">{users.length === 0 ? 'No users in this consumption group.' : 'No users match your search.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <TablePagination
        ariaLabel="User category pagination"
        currentPage={activePage}
        itemCount={matchingUsers.length}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
