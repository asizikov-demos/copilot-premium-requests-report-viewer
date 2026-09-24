'use client';

import { useState } from 'react';

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
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setShowAll(false); }} placeholder="Find a user..." className="w-56 max-w-full rounded-md border border-[#d1d9e0] bg-[#f6f8fa] px-3 py-2 text-sm text-[#1f2328]" />
        </label>
        <span className="text-xs text-[#636c76]" role="status">{matchingUsers.length} matching {matchingUsers.length === 1 ? 'user' : 'users'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-y border-[#d1d9e0] bg-[#f6f8fa] text-[11px] uppercase tracking-wider text-[#636c76]">
            <tr><th scope="col" className="px-5 py-3 text-left">User</th><th scope="col" className="px-5 py-3 text-right">AI Credits</th><th scope="col" className="px-5 py-3 text-right">Included quota</th><th scope="col" className="px-5 py-3 text-right">Used</th></tr>
          </thead>
          <tbody className="divide-y divide-[#d1d9e0]">
            {visibleUsers.map(user => (
              <tr key={user.user} className="hover:bg-[#fcfdff]">
                <td className="px-5 py-3 font-medium text-[#1f2328]">{user.user}</td>
                <td className="px-5 py-3 text-right font-mono text-xs text-[#636c76]">{formatDecimalQuantity(user.totalCredits)}</td>
                <td className="px-5 py-3 text-right font-mono text-xs text-[#636c76]">{user.quota === 'unknown' ? 'Unknown' : user.quota.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono text-xs text-[#636c76]">{user.quota === 'unknown' ? 'Unknown' : `${user.consumptionPercentage.toFixed(1)}%`}</td>
              </tr>
            ))}
            {visibleUsers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-[#636c76]">{users.length === 0 ? 'No users in this consumption group.' : 'No users match your search.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {matchingUsers.length > 6 && <div className="flex items-center justify-between px-5 py-3"><span className="text-xs text-[#636c76]">Showing {visibleUsers.length} of {matchingUsers.length}</span><button onClick={() => setShowAll(!showAll)} className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-xs font-medium text-[#1f2328] hover:bg-[#f6f8fa]">{showAll ? 'Show fewer' : `Show all ${matchingUsers.length}`}</button></div>}
    </div>
  );
}
