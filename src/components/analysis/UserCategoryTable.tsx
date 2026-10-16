'use client';

import { useState } from 'react';
import { Button } from '@primer/react';

import type { UserConsumptionCategory } from '@/utils/analytics/insights';
import { formatDecimalQuantity } from '@/utils/formatters';

interface UserCategoryTableProps {
  users: UserConsumptionCategory[];
}

export function UserCategoryTable({ users }: UserCategoryTableProps) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const matchingUsers = users.filter(user => user.user.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleUsers = showAll ? matchingUsers : matchingUsers.slice(0, 6);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <label className="max-w-full">
          <span className="sr-only">Search users in this group</span>
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setShowAll(false); }} placeholder="Find a user..." className="w-56 max-w-full rounded-md border border-(--borderColor-default) bg-(--bgColor-muted) px-3 py-2 text-sm text-(--fgColor-default)" />
        </label>
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
      {matchingUsers.length > 6 && <div className="flex items-center justify-between px-5 py-3"><span className="text-xs text-(--fgColor-muted)">Showing {visibleUsers.length} of {matchingUsers.length}</span><Button size="small" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${matchingUsers.length}`}</Button></div>}
    </div>
  );
}
