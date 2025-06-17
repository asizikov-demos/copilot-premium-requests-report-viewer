'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PowerUserScore } from '@/types/csv';

// Constants
const DEFAULT_MIN_REQUESTS = 20;
const MAX_MIN_REQUESTS = 10000;
const DEBOUNCE_DELAY = 300;
const MAX_POWER_USERS_DISPLAYED = 20;

interface ScoreDialogProps {
  user: PowerUserScore | null;
  onClose: () => void;
}

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

function Tooltip({ children, content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

interface PowerUsersOverviewProps {
  powerUsers: PowerUserScore[];
  totalQualifiedUsers: number;
  minRequestsThreshold: number;
  onBack: () => void;
  onThresholdChange: (threshold: number) => void;
}

function ScoreBreakdownDialog({ user, onClose }: ScoreDialogProps) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Power User Score Breakdown: {user.user}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-700">Total Score</span>
                  <span className="text-2xl font-bold text-blue-600">{user.totalScore}/100</span>
                </div>
                <div className="text-sm text-gray-700">
                  Based on {Math.round(user.totalRequests * 100) / 100} total requests
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Score Components</h4>
                  
                  <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Model Diversity (30%)</span>
                      <span className="font-medium text-gray-800">{user.breakdown.diversityScore}/30</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Special Features (20%)</span>
                      <span className="font-medium text-gray-800">{user.breakdown.specialFeaturesScore}/20</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Vision Models (15%)</span>
                      <span className="font-medium text-gray-800">{user.breakdown.visionScore}/15</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Balance Score (35%)</span>
                      <span className="font-medium text-gray-800">{user.breakdown.balanceScore}/35</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Model Usage</h4>
                  
                  <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Unique Models</span>
                      <span className="font-medium text-gray-800">{user.modelUsage.uniqueModels}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Light Models</span>
                      <span className="font-medium text-gray-800">{user.modelUsage.light}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Medium Models</span>
                      <span className="font-medium text-gray-800">{user.modelUsage.medium}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Heavy Models</span>
                      <span className="font-medium text-gray-800">{user.modelUsage.heavy}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Special Features</span>
                      <span className="font-medium text-gray-800">{user.modelUsage.special}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Vision Models</span>
                      <span className="font-medium text-gray-800">{user.modelUsage.vision}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PowerUsersOverview({ powerUsers, totalQualifiedUsers, minRequestsThreshold, onBack, onThresholdChange }: PowerUsersOverviewProps) {
  const [selectedUser, setSelectedUser] = useState<PowerUserScore | null>(null);
  const [inputValue, setInputValue] = useState(minRequestsThreshold.toString());
  const [isValidInput, setIsValidInput] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync input value when prop changes
  useEffect(() => {
    setInputValue(minRequestsThreshold.toString());
  }, [minRequestsThreshold]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Debounced threshold change handler
  const debouncedThresholdChange = useCallback((value: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= DEFAULT_MIN_REQUESTS && numValue <= MAX_MIN_REQUESTS) {
        onThresholdChange(numValue);
        setIsValidInput(true);
      } else {
        setIsValidInput(false);
      }
    }, DEBOUNCE_DELAY);
  }, [onThresholdChange]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    debouncedThresholdChange(value);
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
              {!isValidInput && (
                <div className="absolute top-full left-0 mt-1 text-xs text-red-600 whitespace-nowrap">
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
                        {user.totalScore}/100
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
      
      <ScoreBreakdownDialog 
        user={selectedUser} 
        onClose={() => setSelectedUser(null)} 
      />
    </div>
  );
}
