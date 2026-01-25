'use client';

import React, { useState, useEffect } from 'react';
import { PowerUserScore } from '@/types/csv';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Tooltip } from './primitives/Tooltip';
import { PowerUserScoreDialog } from './analysis/PowerUserScoreDialog';
import { DEFAULT_MIN_REQUESTS, MAX_MIN_REQUESTS, DEBOUNCE_DELAY_MS, MAX_POWER_USERS_DISPLAYED, POWER_USER_SCORE_WEIGHTS } from '@/constants/powerUsers';

interface PowerUsersOverviewProps {
  powerUsers: PowerUserScore[];
  totalQualifiedUsers: number;
  minRequestsThreshold: number;
  onBack: () => void;
  onThresholdChange: (threshold: number) => void;
}

export function PowerUsersOverview({ powerUsers, totalQualifiedUsers, minRequestsThreshold, onBack, onThresholdChange }: PowerUsersOverviewProps) {
  const [selectedUser, setSelectedUser] = useState<PowerUserScore | null>(null);
  const [inputValue, setInputValue] = useState(minRequestsThreshold.toString());
  const [touched, setTouched] = useState(false);
  const debounced = useDebouncedValue(inputValue, DEBOUNCE_DELAY_MS);

  // Apply debounced threshold updates
  useEffect(() => {
    const numValue = parseInt(debounced, 10);
    if (!isNaN(numValue) && numValue >= DEFAULT_MIN_REQUESTS && numValue <= MAX_MIN_REQUESTS) {
      onThresholdChange(numValue);
    }
  }, [debounced, onThresholdChange]);

  useEffect(() => {
    setInputValue(minRequestsThreshold.toString());
  }, [minRequestsThreshold]);

  const isValidInput = (() => {
    const num = parseInt(inputValue, 10);
    return !isNaN(num) && num >= DEFAULT_MIN_REQUESTS && num <= MAX_MIN_REQUESTS;
  })();

  const handleInputChange = (value: string) => {
    if (!touched) setTouched(true);
    setInputValue(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Power Users</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Top {MAX_POWER_USERS_DISPLAYED} of {totalQualifiedUsers} qualified users ({minRequestsThreshold}+ requests)
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="threshold" className="text-xs text-zinc-500 whitespace-nowrap">
              Min requests
            </label>
            <div className="relative flex items-center gap-1">
              <input
                id="threshold"
                type="number"
                min={DEFAULT_MIN_REQUESTS}
                max={MAX_MIN_REQUESTS}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                className={`w-20 px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  isValidInput 
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-900' 
                    : 'border-red-300 bg-red-50 text-red-900'
                }`}
                aria-invalid={!isValidInput}
                aria-describedby={!isValidInput ? 'threshold-error' : undefined}
              />
              {minRequestsThreshold !== DEFAULT_MIN_REQUESTS && (
                <button
                  onClick={() => handleInputChange(DEFAULT_MIN_REQUESTS.toString())}
                  className="text-xs text-zinc-400 hover:text-zinc-600 px-1"
                  title={`Reset to ${DEFAULT_MIN_REQUESTS}`}
                >
                  ↺
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                  Rank
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                  User
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                  Score
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                  Requests
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                  Models
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-50">
                  Breakdown
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {powerUsers.map((user, index) => (
                <tr 
                  key={user.user} 
                  className="hover:bg-zinc-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedUser(user)}
                >
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-zinc-400">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">
                    {user.user}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-zinc-900">
                        {user.totalScore}
                      </span>
                      <div className="w-12 bg-zinc-100 rounded-full h-1.5">
                        <div 
                          className="bg-zinc-900 h-1.5 rounded-full" 
                          style={{ width: `${user.totalScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-mono text-zinc-600">
                    {Math.round(user.totalRequests * 100) / 100}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm text-zinc-600">
                    {user.modelUsage.uniqueModels}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      <Tooltip content="Diversity: model variety (0-30)">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700">
                          D:{user.breakdown.diversityScore}
                        </span>
                      </Tooltip>
                      <Tooltip content="Special features (0-20)">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700">
                          S:{user.breakdown.specialFeaturesScore}
                        </span>
                      </Tooltip>
                      <Tooltip content="Vision models (0-15)">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-50 text-purple-700">
                          V:{user.breakdown.visionScore}
                        </span>
                      </Tooltip>
                      <Tooltip content="Model balance (0-35)">
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-50 text-orange-700">
                          B:{user.breakdown.balanceScore}
                        </span>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <PowerUserScoreDialog user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
