'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

import { PRICING } from '@/constants/pricing';
import { useArtifactAnalysis } from '@/hooks/useArtifactAnalysis';
import type { DetailPagesArtifacts } from '@/utils/ingestion/DetailPagesAggregator';
import { 
  IngestionResult, 
  QuotaArtifacts, 
  UsageArtifacts, 
  DailyBucketsArtifacts,
  FeatureUsageArtifacts,
  BillingArtifacts,
  TokenArtifacts,
  ModelDailyArtifacts,
  type BillingPagesArtifacts,
} from '@/utils/ingestion';

// Types
type CopilotPlan = 'business' | 'enterprise';
type ViewType = 'overview' | 'users' | 'costCenters' | 'organizations' | 'codingAgent' | 'insights' | 'modelTrends' | 'aiUsage';

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
  detailPagesArtifacts: DetailPagesArtifacts;
  modelDailyArtifacts: ModelDailyArtifacts;
  reportHasOrganizations: boolean;
  reportHasCostCenters: boolean;
  // Aggregator outputs (new architecture)
  quotaArtifacts: QuotaArtifacts;
  usageArtifacts: UsageArtifacts;
  dailyBucketsArtifacts: DailyBucketsArtifacts;
  featureUsageArtifacts: FeatureUsageArtifacts;
  billingArtifacts?: BillingArtifacts; // new billing summary artifacts
  billingPagesArtifacts: BillingPagesArtifacts;
  tokenArtifacts?: TokenArtifacts | null;
  
  analysis: ReturnType<typeof useArtifactAnalysis>['analysis'];
  userData: ReturnType<typeof useArtifactAnalysis>['userData'];
  allModels: string[];
  dailyCumulativeData: ReturnType<typeof useArtifactAnalysis>['dailyCumulativeData'];
  codingAgentAnalysis: ReturnType<typeof useArtifactAnalysis>['codingAgentAnalysis'];
  codeReviewAnalysis: ReturnType<typeof useArtifactAnalysis>['codeReviewAnalysis'];

  reportMonth?: string;

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

// Exporting the raw context as well (in addition to hook) enables optional consumption
// in components that want to gracefully fallback when provider is absent in tests.
export const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ ingestionResult, filename, onReset, children }: AnalysisProviderProps) {
  // Local UI state that was previously in DataAnalysis
  const [view, setView] = useState<ViewType>('overview');

  // Extract aggregator outputs
  const artifacts = useMemo(() => {
    const outputs = ingestionResult.outputs;
    if (!outputs.billingPages) throw new Error('Missing billingPages output in ingestion result');
    if (!outputs.modelDaily) throw new Error('Missing modelDaily output in ingestion result');
    if (!outputs.detailPages) throw new Error('Missing detailPages output in ingestion result');
    return {
      detailPagesArtifacts: outputs.detailPages as DetailPagesArtifacts,
      billingPagesArtifacts: outputs.billingPages as BillingPagesArtifacts,
      quotaArtifacts: outputs.quota as QuotaArtifacts,
      usageArtifacts: outputs.usage as UsageArtifacts,
      dailyBucketsArtifacts: outputs.dailyBuckets as DailyBucketsArtifacts,
      featureUsageArtifacts: requireFeatureUsageArtifacts(outputs.featureUsage),
      tokenArtifacts: outputs.tokens as TokenArtifacts | null | undefined,
      billingArtifacts: outputs.billing as BillingArtifacts | undefined,
      modelDailyArtifacts: outputs.modelDaily as ModelDailyArtifacts,
    };
  }, [ingestionResult]);

  const reportMonth = artifacts.dailyBucketsArtifacts.dateRange?.min.slice(0, 7);

  const {
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    codingAgentAnalysis,
    codeReviewAnalysis,
  } = useArtifactAnalysis({
    usageArtifacts: artifacts.usageArtifacts,
    quotaArtifacts: artifacts.quotaArtifacts,
    dailyBucketsArtifacts: artifacts.dailyBucketsArtifacts
  });

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
    ...artifacts,
    reportHasOrganizations: artifacts.modelDailyArtifacts.hasOrganizations,
    reportHasCostCenters: artifacts.modelDailyArtifacts.hasCostCenters,
    analysis,
    userData,
    allModels,
    dailyCumulativeData,
    codingAgentAnalysis,
    codeReviewAnalysis,
    reportMonth,
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
