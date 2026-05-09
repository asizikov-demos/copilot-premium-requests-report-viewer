"use client";
import React from 'react';
import { UserConsumptionCategory } from '@/utils/analytics/insights';

interface UserCategoryTableProps {
  users: UserConsumptionCategory[];
  color: 'green' | 'yellow' | 'red';
  limit?: number;
}

const colorMap: Record<'green' | 'yellow' | 'red', { bg: string; text: string }> = {
  green: { bg: 'bg-[#f0fdf4] border border-[#bbf7d0]', text: 'text-[#2da44e]' },
  yellow: { bg: 'bg-[#fffbeb] border border-[#fde68a]', text: 'text-[#d97706]' },
  red: { bg: 'bg-[#fef2f2] border border-[#fecdd3]', text: 'text-[#cf222e]' }
};

export const UserCategoryTable: React.FC<UserCategoryTableProps> = ({ users, color, limit }) => {
  const slice = typeof limit === 'number' ? users.slice(0, limit) : users;
  const c = colorMap[color];
  return (
    <table className="min-w-full divide-y divide-[#d1d9e0]">
      <thead className="bg-[#f6f8fa]">
        <tr>
          <th className="px-6 py-3 text-left text-[11px] font-medium text-[#636c76] uppercase tracking-wider">User</th>
          <th className="px-6 py-3 text-left text-[11px] font-medium text-[#636c76] uppercase tracking-wider">Requests Used</th>
          <th className="px-6 py-3 text-left text-[11px] font-medium text-[#636c76] uppercase tracking-wider">Quota</th>
          <th className="px-6 py-3 text-left text-[11px] font-medium text-[#636c76] uppercase tracking-wider">Consumption %</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-[#d1d9e0]">
        {slice.map((user) => (
          <tr key={user.user} className="bg-white hover:bg-[#fcfdff] transition-colors duration-150">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1f2328]">{user.user}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-[#636c76]">{user.totalRequests.toFixed(2)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-[#636c76]">{user.quota === 'unknown' ? 'Unknown' : user.quota.toString()}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-[#636c76]">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${c.bg} ${c.text}`}>
                {user.consumptionPercentage.toFixed(1)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
