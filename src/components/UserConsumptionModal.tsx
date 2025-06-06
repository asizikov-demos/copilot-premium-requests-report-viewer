'use client';

import { useEffect, useState, useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { createPortal } from 'react-dom';
import { UserConsumptionModalProps } from '@/types/csv';
import { generateUserDailyModelData } from '@/utils/dataAnalysis';
import { 
  getUserData, 
  calculateUserTotalRequests, 
  calculateOverageRequests, 
  calculateOverageCost 
} from '@/utils/userCalculations';
import { PRICING } from '@/constants/pricing';

// Generate colors for model bars
const generateModelColors = (models: string[]): Record<string, string> => {
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
    '#14B8A6', // teal-500
    '#F43F5E', // rose-500
  ];
  
  const result: Record<string, string> = {};
  models.forEach((model, index) => {
    result[model] = colors[index % colors.length];
  });
  return result;
};

export function UserConsumptionModal({ 
  user, 
  processedData, 
  selectedPlan, 
  currentQuota, 
  onClose 
}: UserConsumptionModalProps) {
  const [mounted, setMounted] = useState(false);

  // Generate daily model data for this user
  const userDailyData = useMemo(() => {
    return generateUserDailyModelData(processedData, user);
  }, [processedData, user]);

  // Get filtered user data (single source of truth)
  const userData = useMemo(() => {
    return getUserData(processedData, user);
  }, [processedData, user]);

  // Get models used by this user
  const userModels = useMemo(() => {
    return Array.from(new Set(userData.map(d => d.model))).sort();
  }, [userData]);

  const modelColors = useMemo(() => generateModelColors(userModels), [userModels]);

  // Calculate user's total requests using shared utility
  const userTotalRequests = useMemo(() => {
    return calculateUserTotalRequests(processedData, user);
  }, [processedData, user]);

  // Calculate overage requests and cost using shared utilities
  const overageRequests = useMemo(() => {
    return calculateOverageRequests(userTotalRequests, currentQuota);
  }, [userTotalRequests, currentQuota]);

  const overageCost = useMemo(() => {
    return calculateOverageCost(overageRequests);
  }, [overageRequests]);

  useEffect(() => {
    setMounted(true);
    
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    
    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = 'auto';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const planInfo = {
    business: { name: 'Copilot Business', monthlyQuota: 300 },
    enterprise: { name: 'Copilot Enterprise', monthlyQuota: 1000 }
  };

  // Define proper types for tooltip data
  interface TooltipEntry {
    dataKey: string;
    value: number;
    color: string;
  }

  interface TooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length && label) {
      const date = new Date(label);
      const formattedDate = date.toLocaleDateString();
      
      // Separate cumulative line from model bars
      const cumulativeData = payload.find((entry: TooltipEntry) => entry.dataKey === 'totalCumulative');
      const modelData = payload.filter((entry: TooltipEntry) => entry.dataKey !== 'totalCumulative' && entry.value > 0);
      
      // Calculate daily total from model data
      const dailyTotal = modelData.reduce((sum: number, entry: TooltipEntry) => sum + entry.value, 0);
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{formattedDate}</p>
          
          {/* Daily breakdown */}
          {modelData.length > 0 ? (
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-700 mb-1">Daily Usage:</p>
              {modelData.map((entry: TooltipEntry, entryIndex: number) => (
                <p key={entryIndex} className="text-sm ml-2" style={{ color: entry.color }}>
                  • {entry.dataKey}: {entry.value.toFixed(1)} requests
                </p>
              ))}
              <p className="text-sm font-semibold text-gray-900 ml-2 mt-1">
                Daily Total: {dailyTotal.toFixed(1)} requests
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-2">No requests this day</p>
          )}
          
          {/* Cumulative total */}
          {cumulativeData && (
            <p className="text-sm text-blue-600 font-semibold border-t border-gray-200 pt-2">
              Cumulative Total: {cumulativeData.value.toFixed(1)} requests
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (!mounted) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] 2xl:max-w-[85vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user}</h2>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6 mt-1">
              <p className="text-sm text-gray-500">
                {planInfo[selectedPlan].name} - Daily Usage Overview
              </p>
              <p className="text-sm text-gray-500">
                Total requests: {userTotalRequests.toFixed(1)} / {currentQuota} quota
              </p>
              {overageRequests > 0 && (
                <p className="text-sm text-red-600 font-medium" role="alert">
                  Overage cost: ${overageCost.toFixed(2)} ({overageRequests.toFixed(1)} requests × ${PRICING.OVERAGE_RATE_PER_REQUEST.toFixed(2)})
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chart Content */}
        <div className="flex-1 overflow-auto p-6">
          {userDailyData.length > 0 ? (
            <div className="space-y-4">
              {/* Chart Description */}
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                <p><strong>Chart Explanation:</strong></p>
                <p>• <strong>Stacked Bars:</strong> Daily requests per model (stacked on top of each other)</p>
                <p>• <strong>Black Line:</strong> Cumulative total requests over time</p>
                <p>• <strong>Red Dotted Line:</strong> Monthly quota limit</p>
              </div>
              
              {/* Chart */}
              <div className="h-96 2xl:h-[32rem] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={userDailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                  <YAxis 
                    stroke="#6b7280" 
                    fontSize={12}
                    domain={[0, (dataMax: number) => Math.max(currentQuota, dataMax)]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Quota reference line */}
                  <ReferenceLine 
                    y={currentQuota} 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{ 
                      value: `${currentQuota} quota limit`, 
                      position: "insideTopRight",
                      style: { fontSize: '12px', fill: '#ef4444' }
                    }}
                  />
                  
                  {/* Stacked bars for each model */}
                  {userModels.map((model) => (
                    <Bar
                      key={model}
                      dataKey={model}
                      stackId="models"
                      fill={modelColors[model]}
                      name={model}
                    />
                  ))}
                  
                  {/* Cumulative total line */}
                  <Line
                    type="monotone"
                    dataKey="totalCumulative"
                    stroke="#1f2937"
                    strokeWidth={3}
                    dot={{ fill: '#1f2937', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Cumulative Total"
                  />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No data available for this user
            </div>
          )}

          {/* Legend */}
          {userModels.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Models Used</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {userModels.map((model) => (
                  <div key={model} className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: modelColors[model] }}
                    />
                    <span className="text-xs text-gray-600 truncate" title={model}>
                      {model.length > 20 ? `${model.substring(0, 20)}...` : model}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
