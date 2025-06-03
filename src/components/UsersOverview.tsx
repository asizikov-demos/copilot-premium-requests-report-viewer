'use client';

import { UserSummary } from '@/utils/dataAnalysis';

interface UsersOverviewProps {
  userData: UserSummary[];
  allModels: string[];
  onBack: () => void;
}

export function UsersOverview({ userData, allModels, onBack }: UsersOverviewProps) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <h3 className="text-lg font-medium text-gray-900">Users Overview</h3>
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ← Back to Summary
        </button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0 z-30 min-w-40 border-r border-gray-200">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-32">
                Total Requests
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-40">
                Total Requests with Multipliers
              </th>
              {allModels.map((model) => (
                <th
                  key={model}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-32"
                  title={model}
                >
                  {model.length > 20 ? `${model.substring(0, 20)}...` : model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {userData.map((user, index) => (
              <tr key={user.user} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 z-10 border-r border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="max-w-32 truncate" title={user.user}>
                    {user.user}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                  {user.totalRequests.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold text-blue-600">
                  {user.totalRequestsWithMultipliers.toFixed(2)}
                </td>
                {allModels.map((model) => (
                  <td
                    key={`${user.user}-${model}`}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {user.modelBreakdown[model]?.toFixed(2) || '0.00'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {userData.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500 flex-shrink-0">
          No user data available
        </div>
      )}
    </div>
  );
}
