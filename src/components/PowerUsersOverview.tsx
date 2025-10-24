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

// Score breakdown dialog extracted to dedicated component

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Power Users Overview</h2>
          <p className="text-sm text-gray-600 mt-1">
            Top {MAX_POWER_USERS_DISPLAYED} power users out of {totalQualifiedUsers} qualified users ({minRequestsThreshold}+ requests)
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
          <div className="relative flex items-center gap-2">
            <label htmlFor="threshold" className="text-xs text-gray-600 whitespace-nowrap">
              Min Requests Threshold
            </label>
            <div className="relative flex items-center gap-1">
              <input
                id="threshold"
                type="number"
                min={DEFAULT_MIN_REQUESTS}
                max={MAX_MIN_REQUESTS}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                className={`w-20 px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-600 ${
                  isValidInput 
                    ? 'border-gray-300' 
                    : 'border-red-300 bg-red-50'
                }`}
                aria-invalid={!isValidInput}
                aria-describedby={!isValidInput ? 'threshold-error' : undefined}
              />
              {minRequestsThreshold !== DEFAULT_MIN_REQUESTS && (
                <button
                  onClick={() => handleInputChange(DEFAULT_MIN_REQUESTS.toString())}
                  className="text-xs text-blue-600 hover:text-blue-800 px-1"
                  title={`Reset to default (${DEFAULT_MIN_REQUESTS})`}
                >
                  ↺
                </button>
              )}
              {!isValidInput && touched && (
                <div id="threshold-error" className="absolute top-full left-0 mt-1 text-xs text-red-600 whitespace-nowrap">
                  Must be {DEFAULT_MIN_REQUESTS}–{MAX_MIN_REQUESTS.toLocaleString()}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ← Back to Summary
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Power Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Requests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unique Models
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score Breakdown
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {powerUsers.map((user, index) => (
                <tr 
                  key={user.user} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedUser(user)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.user}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900 mr-2">
                        {user.totalScore}/{POWER_USER_SCORE_WEIGHTS.total}
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${user.totalScore}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {Math.round(user.totalRequests * 100) / 100}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.modelUsage.uniqueModels}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-1">
                      <Tooltip content="Diversity: Score based on using multiple different models (0-30 points)">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 cursor-help">
                          D: {user.breakdown.diversityScore}
                        </span>
                      </Tooltip>
                      <Tooltip content="Special: Score for using Code Review, Spark and Coding Agent features (0-20 points)">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 cursor-help">
                          S: {user.breakdown.specialFeaturesScore}
                        </span>
                      </Tooltip>
                      <Tooltip content="Vision: Score for using vision-enabled models (0-15 points)">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 cursor-help">
                          V: {user.breakdown.visionScore}
                        </span>
                      </Tooltip>
                      <Tooltip content="Balance: Score for optimal mix of heavy/light models - best at 20-40% heavy (0-35 points)">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 cursor-help">
                          B: {user.breakdown.balanceScore}
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
