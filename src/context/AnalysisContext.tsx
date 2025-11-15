'use client';

import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { ProcessedData } from '@/types/csv';
import { useAnalysisFilters } from '@/hooks/useAnalysisFilters';
import { useAnalyzedData } from '@/hooks/useAnalyzedData';
import { PRICING } from '@/constants/pricing';
import { 
  IngestionResult, 
  QuotaArtifacts, 
  UsageArtifacts, 
  DailyBucketsArtifacts,
  FeatureUsageArtifacts,
  BillingArtifacts,
  NormalizedRow,
  buildProcessedDataFromRows
} from '@/utils/ingestion';

// Types
type CopilotPlan = 'business' | 'enterprise';
type ViewType = 'overview' | 'users' | 'powerUsers' | 'codingAgent' | 'insights' | 'costOptimization';

interface AnalysisProviderProps {
  ingestionResult: IngestionResult;
  filename: string;
  onReset: () => void;
  children: ReactNode;
}

interface PlanInfoEntry {
  name: string;
  monthlyQuota: number;
}

interface AnalysisContextValue {
  // Aggregator outputs (new architecture)
  quotaArtifacts: QuotaArtifacts;
  usageArtifacts: UsageArtifacts;
  dailyBucketsArtifacts: DailyBucketsArtifacts;
  featureUsageArtifacts?: FeatureUsageArtifacts; // optional until fully adopted
  billingArtifacts?: BillingArtifacts; // new billing summary artifacts
  
  // Raw & processed (adapter bridge - to be phased out)
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
  selectedMonths: string[];
  setSelectedMonths: (v: string[]) => void;
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

// Exporting the raw context as well (in addition to hook) enables optional consumption
// in components that want to gracefully fallback when provider is absent (e.g. tests
// that mount a component in isolation like UserConsumptionModal).
export const AnalysisContext = createContext<AnalysisContextValue | null>(null);

const DEFAULT_MIN_REQUESTS = 20;

export function AnalysisProvider({ ingestionResult, filename, onReset, children }: AnalysisProviderProps) {
  // Local UI state that was previously in DataAnalysis
  const [selectedPlan, setSelectedPlan] = useState<CopilotPlan>('business');
  const [view, setView] = useState<ViewType>('overview');
  const [minRequestsThreshold, setMinRequestsThreshold] = useState(DEFAULT_MIN_REQUESTS);

  // Extract aggregator outputs
  const { quotaArtifacts, usageArtifacts, dailyBucketsArtifacts, billingArtifacts } = useMemo(() => {
    return {
      quotaArtifacts: ingestionResult.outputs.quota as QuotaArtifacts,
      usageArtifacts: ingestionResult.outputs.usage as UsageArtifacts,
      dailyBucketsArtifacts: ingestionResult.outputs.dailyBuckets as DailyBucketsArtifacts,
      featureUsageArtifacts: ingestionResult.outputs.featureUsage as FeatureUsageArtifacts | undefined,
      billingArtifacts: ingestionResult.outputs.billing as BillingArtifacts | undefined
    };
  }, [ingestionResult]);

  // Build ProcessedData for hooks that still need it (adapter bridge)
  const baseProcessed = useMemo(() => {
    const rawRows = ingestionResult.outputs.rawData as NormalizedRow[] | undefined;
    return buildProcessedDataFromRows(rawRows);
  }, [ingestionResult]);

  const {
    selectedMonths,
    setSelectedMonths,
    availableMonths,
    hasMultipleMonthsData
  } = useAnalysisFilters(baseProcessed, dailyBucketsArtifacts);

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
    selectedMonths,
    minRequestsThreshold,
    usageArtifacts,
    quotaArtifacts,
    dailyBucketsArtifacts
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
    // New aggregator artifacts
    quotaArtifacts,
    usageArtifacts,
    dailyBucketsArtifacts,
    featureUsageArtifacts: ingestionResult.outputs.featureUsage as FeatureUsageArtifacts | undefined,
    billingArtifacts: billingArtifacts,
    // Legacy adapter bridge
    baseProcessed,
    processedData,
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    powerUsersAnalysis,
    codingAgentAnalysis,
    weeklyExhaustion,
    selectedMonths,
    setSelectedMonths,
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
