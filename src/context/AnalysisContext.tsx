'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

import { PRICING } from '@/constants/pricing';
import { useAnalysisFilters } from '@/hooks/useAnalysisFilters';
import { useAnalyzedData } from '@/hooks/useAnalyzedData';
import { ProcessedData } from '@/types/csv';
import { 
  IngestionResult, 
  QuotaArtifacts, 
  UsageArtifacts, 
  DailyBucketsArtifacts,
  FeatureUsageArtifacts,
  BillingArtifacts,
  TokenArtifacts,
  NormalizedRow,
  buildBillingArtifactsFromProcessedData,
  buildUsageArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  buildDailyBucketsArtifactsFromProcessedData,
  buildFeatureUsageArtifactsFromProcessedData,
  buildTokenArtifactsFromProcessedData,
  filterTokenArtifactsByMonths,
  buildProcessedDataFromRows
} from '@/utils/ingestion';

// Types
type CopilotPlan = 'business' | 'enterprise';
type ViewType = 'overview' | 'users' | 'costCenters' | 'organizations' | 'codingAgent' | 'insights' | 'costOptimization' | 'modelTrends' | 'aiUsage';

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
  featureUsageArtifacts: FeatureUsageArtifacts;
  billingArtifacts?: BillingArtifacts; // new billing summary artifacts
  tokenArtifacts?: TokenArtifacts | null;
  
  // Raw & processed (adapter bridge - to be phased out)
  baseProcessed: ProcessedData[];
  processedData: ReturnType<typeof useAnalyzedData>['processedData'];
  aggregateProcessedData: ReturnType<typeof useAnalyzedData>['aggregateProcessedData'];
  analysis: ReturnType<typeof useAnalyzedData>['analysis'];
  userData: ReturnType<typeof useAnalyzedData>['userData'];
  allModels: string[];
  dailyCumulativeData: ReturnType<typeof useAnalyzedData>['dailyCumulativeData'];
  codingAgentAnalysis: ReturnType<typeof useAnalyzedData>['codingAgentAnalysis'];
  codeReviewAnalysis: ReturnType<typeof useAnalyzedData>['codeReviewAnalysis'];
  weeklyExhaustion: ReturnType<typeof useAnalyzedData>['weeklyExhaustion'];

  // Filters
  selectedMonths: string[];
  setSelectedMonths: (v: string[]) => void;
  availableMonths: { value: string; label: string }[];
  hasMultipleMonthsData: boolean;

  // Thresholds & state
  selectedPlan: CopilotPlan;
  view: ViewType;
  setView: (v: ViewType) => void;

  // Derived UI helpers
  isDetailViewActive: boolean;
  planInfo: Record<CopilotPlan, PlanInfoEntry>;

  // Misc
  filename: string;
  onReset: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFeatureUsageArtifacts(value: unknown): value is FeatureUsageArtifacts {
  if (!isRecord(value)) {
    return false;
  }

  const { featureTotals, featureUsers, specialTotals } = value;

  return (
    isRecord(featureTotals) &&
    typeof featureTotals.codeReview === 'number' &&
    typeof featureTotals.codingAgent === 'number' &&
    typeof featureTotals.spark === 'number' &&
    typeof featureTotals.codeQuality === 'number' &&
    isRecord(featureUsers) &&
    featureUsers.codeReview instanceof Set &&
    featureUsers.codingAgent instanceof Set &&
    featureUsers.spark instanceof Set &&
    featureUsers.codeQuality instanceof Set &&
    isRecord(specialTotals) &&
    typeof specialTotals.unattributedCodeReview === 'number' &&
    typeof specialTotals.unattributedCodeQuality === 'number'
  );
}

function requireFeatureUsageArtifacts(value: unknown): FeatureUsageArtifacts {
  if (!isFeatureUsageArtifacts(value)) {
    throw new Error('Missing or invalid featureUsage output in ingestion result');
  }

  return value;
}

function withBillingArtifactDefaults(value: BillingArtifacts | undefined): BillingArtifacts | undefined {
  if (!value) {
    return undefined;
  }

  return {
    ...value,
    users: value.users ?? [],
    userMap: value.userMap ?? new Map(),
    orgTotals: value.orgTotals ?? new Map(),
    costCenterTotals: value.costCenterTotals ?? new Map(),
    billingByModel: value.billingByModel ?? new Map(),
    specialBuckets: value.specialBuckets ?? [],
  };
}

// Exporting the raw context as well (in addition to hook) enables optional consumption
// in components that want to gracefully fallback when provider is absent in tests.
export const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ ingestionResult, filename, onReset, children }: AnalysisProviderProps) {
  // Local UI state that was previously in DataAnalysis
  const [view, setView] = useState<ViewType>('overview');

  // Extract aggregator outputs
  const { quotaArtifacts, usageArtifacts, dailyBucketsArtifacts, featureUsageArtifacts, billingArtifacts, tokenArtifacts } = useMemo(() => {
    return {
      quotaArtifacts: ingestionResult.outputs.quota as QuotaArtifacts,
      usageArtifacts: ingestionResult.outputs.usage as UsageArtifacts,
      dailyBucketsArtifacts: ingestionResult.outputs.dailyBuckets as DailyBucketsArtifacts,
      featureUsageArtifacts: requireFeatureUsageArtifacts(ingestionResult.outputs.featureUsage),
      tokenArtifacts: ingestionResult.outputs.tokens as TokenArtifacts | null | undefined,
      billingArtifacts: withBillingArtifactDefaults(ingestionResult.outputs.billing as BillingArtifacts | undefined)
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

  const periodRows = useMemo(() => selectedMonths.length === 0
    ? baseProcessed
    : baseProcessed.filter((row) => selectedMonths.includes(row.monthKey)),
  [baseProcessed, selectedMonths]);
  const scopedArtifacts = useMemo(() => selectedMonths.length === 0
    ? { usageArtifacts, quotaArtifacts, dailyBucketsArtifacts, featureUsageArtifacts }
    : {
      usageArtifacts: buildUsageArtifactsFromProcessedData(periodRows),
      quotaArtifacts: buildQuotaArtifactsFromProcessedData(periodRows),
      dailyBucketsArtifacts: buildDailyBucketsArtifactsFromProcessedData(periodRows),
      featureUsageArtifacts: buildFeatureUsageArtifactsFromProcessedData(periodRows),
    },
  [dailyBucketsArtifacts, featureUsageArtifacts, periodRows, quotaArtifacts, selectedMonths.length, usageArtifacts]);

  const {
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    codingAgentAnalysis,
    codeReviewAnalysis,
    processedData,
    aggregateProcessedData,
    weeklyExhaustion
  } = useAnalyzedData({
    baseProcessed,
    selectedMonths,
    usageArtifacts: scopedArtifacts.usageArtifacts,
    quotaArtifacts: scopedArtifacts.quotaArtifacts,
    dailyBucketsArtifacts: scopedArtifacts.dailyBucketsArtifacts
  });

  const effectiveBillingArtifacts = useMemo(() => (
    baseProcessed.length > 0
      ? buildBillingArtifactsFromProcessedData(aggregateProcessedData)
      : billingArtifacts
  ), [aggregateProcessedData, baseProcessed.length, billingArtifacts]);

  const effectiveTokenArtifacts = useMemo(() => {
    // Null records an ingestion failure; absence means no token artifact.
    if (tokenArtifacts === null) return null;
    if (tokenArtifacts) {
      return filterTokenArtifactsByMonths(tokenArtifacts, selectedMonths);
    }
    return baseProcessed.length > 0
      ? buildTokenArtifactsFromProcessedData(aggregateProcessedData)
      : undefined;
  }, [aggregateProcessedData, baseProcessed.length, selectedMonths, tokenArtifacts]);

  // Use the suggested plan from data (auto-derived from report content)
  const selectedPlan = analysis.quotaBreakdown.suggestedPlan ?? 'business';

  const planInfo: Record<CopilotPlan, PlanInfoEntry> = useMemo(() => ({
    business: {
      name: 'Copilot Business',
      monthlyQuota: PRICING.BUSINESS_AI_CREDIT_QUOTA
    },
    enterprise: {
      name: 'Copilot Enterprise',
      monthlyQuota: PRICING.ENTERPRISE_AI_CREDIT_QUOTA
    }
  }), []);

  const isDetailViewActive = view !== 'overview';

  const value: AnalysisContextValue = {
    // New aggregator artifacts
    quotaArtifacts: scopedArtifacts.quotaArtifacts,
    usageArtifacts: scopedArtifacts.usageArtifacts,
    dailyBucketsArtifacts: scopedArtifacts.dailyBucketsArtifacts,
    featureUsageArtifacts: scopedArtifacts.featureUsageArtifacts,
    billingArtifacts: effectiveBillingArtifacts,
    tokenArtifacts: effectiveTokenArtifacts,
    // Legacy adapter bridge
    baseProcessed,
    processedData,
    aggregateProcessedData,
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    codingAgentAnalysis,
    codeReviewAnalysis,
    weeklyExhaustion,
    selectedMonths,
    setSelectedMonths,
    availableMonths,
    hasMultipleMonthsData,
    selectedPlan,
    view,
    setView,
    isDetailViewActive,
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
