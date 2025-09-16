'use client';

import { WeeklyExhaustionData } from '@/utils/analytics/weeklyQuota';

interface WeeklyQuotaExhaustionProps {
  weeklyExhaustion: WeeklyExhaustionData;
  totalUsers: number;
}

export function WeeklyQuotaExhaustion({ 
  weeklyExhaustion, 
  totalUsers 
}: WeeklyQuotaExhaustionProps) {
  const { week1Exhausted, week2Exhausted, week3Exhausted } = weeklyExhaustion;
  
  const weeks = [
    { 
      label: 'Week 1 (Days 1-7)', 
      users: week1Exhausted, 
      color: 'red',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800'
    },
    { 
      label: 'Week 2 (Days 8-14)', 
      users: week2Exhausted, 
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-800'
    },
    { 
      label: 'Week 3 (Days 15-21)', 
      users: week3Exhausted, 
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800'
    },
  ];
  
  const totalEarlyExhausters = week1Exhausted.length + week2Exhausted.length + week3Exhausted.length;
  
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            <strong>{totalEarlyExhausters}</strong> of <strong>{totalUsers}</strong> users 
            ({totalUsers > 0 ? ((totalEarlyExhausters / totalUsers) * 100).toFixed(1) : 0}%) 
            exhausted quota before day 21
          </span>
        </div>
      </div>
      
      {/* Weekly Breakdown */}
      <div className="space-y-4">
        {weeks.map((week) => (
          <div key={week.label} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">{week.label}</h4>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${week.bgColor} ${week.textColor}`}>
                {week.users.length} user{week.users.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {week.users.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {week.users.slice(0, 8).map(user => (
                    <span 
                      key={user} 
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded border"
                      title={user}
                    >
                      {user.length > 15 ? `${user.substring(0, 15)}...` : user}
                    </span>
                  ))}
                  {week.users.length > 8 && (
                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded border">
                      +{week.users.length - 8} more
                    </span>
                  )}
                </div>
                {week.users.length > 8 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      Show all {week.users.length} users
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {week.users.slice(8).map(user => (
                        <span 
                          key={user} 
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded border"
                        >
                          {user}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No users exhausted quota during this period
              </p>
            )}
          </div>
        ))}
      </div>
      
      {totalEarlyExhausters === 0 && (
        <div className="text-center py-6">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-gray-500 text-sm">
            No users exhausted their quota before day 21 in the current period.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            This indicates well-balanced usage patterns across your organization.
          </p>
        </div>
      )}
    </div>
  );
}