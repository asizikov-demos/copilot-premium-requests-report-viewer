"use client";
import React from 'react';
import { UserConsumptionCategory } from '@/utils/analytics/insights';

interface UserCategoryTableProps {
  users: UserConsumptionCategory[];
  color: 'green' | 'yellow' | 'red';
  limit?: number;
}

const colorMap: Record<'green' | 'yellow' | 'red', { bg: string; text: string }> = {
  green: { bg: 'bg-green-100', text: 'text-green-800' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  red: { bg: 'bg-red-100', text: 'text-red-800' }
};

export const UserCategoryTable: React.FC<UserCategoryTableProps> = ({ users, color, limit }) => {
  const slice = typeof limit === 'number' ? users.slice(0, limit) : users;
  const c = colorMap[color];
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests Used</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quota</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consumption %</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {slice.map((user, index) => (
          <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.user}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.totalRequests.toFixed(2)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.quota === 'unlimited' ? 'Unlimited' : user.quota.toString()}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
                {user.consumptionPercentage.toFixed(1)}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
