'use client';

import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { CSVData, ProcessedData } from '@/types/csv';
import { processCSVData } from '@/utils/analytics';
import { useAnalysisFilters } from '@/hooks/useAnalysisFilters';
import { useAnalyzedData } from '@/hooks/useAnalyzedData';
import { PRICING } from '@/constants/pricing';

// Types
type CopilotPlan = 'business' | 'enterprise';
type ViewType = 'overview' | 'users' | 'powerUsers' | 'codingAgent' | 'insights';

interface AnalysisProviderProps {
  csvData: CSVData[];
  filename: string;
  onReset: () => void;
  children: ReactNode;
}

interface PlanInfoEntry {
  name: string;
  monthlyQuota: number;
}

interface AnalysisContextValue {
  // Raw & processed
  baseProcessed: ProcessedData[];
  processedData: ReturnType<typeof useAnalyzedData>['processedData'];
  analysis: ReturnType<typeof useAnalyzedData>['analysis'];
  userData: ReturnType<typeof useAnalyzedData>['userData'];
  allModels: string[];
  dailyCumulativeData: ReturnType<typeof useAnalyzedData>['dailyCumulativeData'];
  powerUsersAnalysis: ReturnType<typeof useAnalyzedData>['powerUsersAnalysis'];
  codingAgentAnalysis: ReturnType<typeof useAnalyzedData>['codingAgentAnalysis'];
  weeklyExhaustion: ReturnType<typeof useAnalyzedData>['weeklyExhaustion'];

  // Filters
  excludeEarlyJune: boolean;
  setExcludeEarlyJune: (v: boolean) => void;
  selectedMonths: string[];
  setSelectedMonths: (months: string[]) => void;
  hasJune2025Data: boolean;
  availableMonths: { value: string; label: string }[];
  hasMultipleMonthsData: boolean;

  // Thresholds & state
  minRequestsThreshold: number;
  setMinRequestsThreshold: (v: number) => void;
  selectedPlan: CopilotPlan;
  setSelectedPlan: (p: CopilotPlan) => void;
  view: ViewType;
  setView: (v: ViewType) => void;

  // Derived UI helpers
  isDetailViewActive: boolean;
  chartData: Array<{ model: string; fullModel: string; requests: number }>;
  planInfo: Record<CopilotPlan, PlanInfoEntry>;

  // Misc
  filename: string;
  onReset: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

const DEFAULT_MIN_REQUESTS = 20;

export function AnalysisProvider({ csvData, filename, onReset, children }: AnalysisProviderProps) {
  // Local UI state that was previously in DataAnalysis
  const [selectedPlan, setSelectedPlan] = useState<CopilotPlan>('business');
  const [view, setView] = useState<ViewType>('overview');
  const [minRequestsThreshold, setMinRequestsThreshold] = useState(DEFAULT_MIN_REQUESTS);

  // Heavy processing moved here
  const baseProcessed = useMemo(() => processCSVData(csvData), [csvData]);

  const {
    excludeEarlyJune,
    setExcludeEarlyJune,
    selectedMonths,
    setSelectedMonths,
    hasJune2025Data,
    availableMonths,
    hasMultipleMonthsData
  } = useAnalysisFilters(baseProcessed);

  const {
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    powerUsersAnalysis,
    codingAgentAnalysis,
    processedData,
    weeklyExhaustion
  } = useAnalyzedData({
    baseProcessed,
    excludeEarlyJune,
    selectedMonths,
    minRequestsThreshold
  });

  // Auto-select plan when suggested by quota breakdown
  useEffect(() => {
    if (analysis.quotaBreakdown.suggestedPlan) {
      setSelectedPlan(analysis.quotaBreakdown.suggestedPlan);
    }
  }, [analysis.quotaBreakdown.suggestedPlan]);

  const chartData = useMemo(() => (
    analysis.requestsByModel.map(item => ({
      model: item.model.length > 20 ? `${item.model.substring(0, 20)}...` : item.model,
      fullModel: item.model,
      requests: Math.round(item.totalRequests * 100) / 100
    }))
  ), [analysis.requestsByModel]);

  const planInfo: Record<CopilotPlan, PlanInfoEntry> = useMemo(() => ({
    business: {
      name: 'Copilot Business',
      monthlyQuota: PRICING.BUSINESS_QUOTA
    },
    enterprise: {
      name: 'Copilot Enterprise',
      monthlyQuota: PRICING.ENTERPRISE_QUOTA
    }
  }), []);

  const isDetailViewActive = view !== 'overview';

  const value: AnalysisContextValue = {
    baseProcessed,
    processedData,
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    powerUsersAnalysis,
    codingAgentAnalysis,
    weeklyExhaustion,
    excludeEarlyJune,
    setExcludeEarlyJune,
    selectedMonths,
    setSelectedMonths,
    hasJune2025Data,
    availableMonths,
    hasMultipleMonthsData,
    minRequestsThreshold,
    setMinRequestsThreshold,
    selectedPlan,
    setSelectedPlan,
    view,
    setView,
    isDetailViewActive,
    chartData,
    planInfo,
    filename,
    onReset
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysisContext(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error('useAnalysisContext must be used within an AnalysisProvider');
  }
  return ctx;
}
