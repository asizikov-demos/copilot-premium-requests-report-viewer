'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { UserSummary, DailyCumulativeData } from '@/utils/dataAnalysis';

interface UsersOverviewProps {
  userData: UserSummary[];
  allModels: string[];
  selectedPlan: 'business' | 'enterprise';
  dailyCumulativeData: DailyCumulativeData[];
  onBack: () => void;
}

// Generate colors for user lines
const generateUserColors = (users: string[]): Record<string, string> => {
  const colors = [
    '#3B82F6', // blue-500
    '#EF4444', // red-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#8B5CF6', // violet-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
    '#F97316', // orange-500
    '#EC4899', // pink-500
    '#6366F1', // indigo-500
  ];
  
  const result: Record<string, string> = {};
  users.forEach((user, index) => {
    result[user] = colors[index % colors.length];
  });
  return result;
};

export function UsersOverview({ userData, allModels, selectedPlan, dailyCumulativeData, onBack }: UsersOverviewProps) {
  const planInfo = {
    business: {
      name: 'Copilot Business',
      monthlyQuota: 300
    },
    enterprise: {
      name: 'Copilot Enterprise', 
      monthlyQuota: 1000
    }
  };

  const currentQuota = planInfo[selectedPlan].monthlyQuota;
  
  // Get users for chart
  const chartUsers = userData.map(u => u.user);
  const userColors = generateUserColors(chartUsers);

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Users Overview</h3>
          <p className="text-sm text-gray-500 mt-1">
            {planInfo[selectedPlan].name} - {currentQuota} premium requests/month
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ← Back to Summary
        </button>
      </div>
      
      {/* Premium Request Quota Consumption Chart - Sticky */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 flex-shrink-0">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Premium Request Quota Consumption</h4>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyCumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip 
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString();
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)} requests`,
                  name
                ]}
              />
              {/* Quota reference line */}
              <ReferenceLine 
                y={currentQuota} 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `${currentQuota} quota limit`, position: "insideTopRight" }}
              />
              {/* User lines */}
              {chartUsers.map((user) => (
                <Line
                  key={user}
                  type="monotone"
                  dataKey={user}
                  stroke={userColors[user]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Scrollable Table Area */}
      <div className="flex-1 overflow-auto">
        <div className="border-t border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0 z-30 min-w-40 border-r border-gray-200">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-32">
                Total Requests
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
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold ${
                  user.totalRequests > currentQuota 
                    ? 'text-red-600' 
                    : 'text-blue-600'
                }`}>
                  {user.totalRequests.toFixed(2)}
                  {user.totalRequests > currentQuota && (
                    <span className="ml-2 text-xs text-red-500">
                      (Exceeds quota by {(user.totalRequests - currentQuota).toFixed(2)})
                    </span>
                  )}
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
      </div>
      
      {userData.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500 flex-shrink-0">
          No user data available
        </div>
      )}
    </div>
  );
}
