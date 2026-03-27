'use client';

import React, { useMemo, useState } from 'react';
import { ProcessedData } from '@/types/csv';
import { UserSummary } from '@/utils/analytics';
import { categorizeUserConsumption, calculateFeatureUtilization, calculateUnusedValue, CONSUMPTION_THRESHOLDS } from '@/utils/analytics/insights';

import type { WeeklyExhaustionData } from '@/utils/analytics/weeklyQuota';
import { AnalysisContext } from '@/context/AnalysisContext';
import { QuotaArtifacts, UsageArtifacts, FeatureUsageArtifacts } from '@/utils/ingestion/types';
import { buildConsumptionCategoriesFromArtifacts, buildFeatureUtilizationFromArtifacts } from '@/utils/ingestion/analytics';
import { ExpandableSection } from './primitives/ExpandableSection';
import { UserCategoryTable } from './analysis/UserCategoryTable';
import { AdvisorySection } from './insights/AdvisorySection';
import { WeeklyQuotaExhaustion } from './insights/WeeklyQuotaExhaustion';

interface InsightsOverviewProps {
  userData: UserSummary[];
  processedData: ProcessedData[]; // transitional
  quotaArtifacts?: QuotaArtifacts;
  usageArtifacts?: UsageArtifacts;
  featureUsageArtifacts?: FeatureUsageArtifacts;
  // Weekly exhaustion artifact (computeWeeklyQuotaExhaustionFromArtifacts output). Typed loosely here since we only read weekNumber & usersExhaustedInWeek.
  weeklyExhaustionArtifacts?: { weeks: Array<{ weekNumber: number; usersExhaustedInWeek: number; startDate: string; endDate: string }>; totalUsersExhausted: number };
  onBack?: () => void;
}

export function InsightsOverview({ userData, processedData, quotaArtifacts, usageArtifacts, featureUsageArtifacts, weeklyExhaustionArtifacts, onBack }: InsightsOverviewProps) {
  const [isPowerUsersExpanded, setIsPowerUsersExpanded] = useState(false);
  const [isAverageUsersExpanded, setIsAverageUsersExpanded] = useState(false);
  const [isLowAdoptionExpanded, setIsLowAdoptionExpanded] = useState(false);
  const analysisCtx = React.useContext(AnalysisContext);
  const quotaArtifactsFromCtx = analysisCtx?.quotaArtifacts as QuotaArtifacts | undefined;
  const usageArtifactsFromCtx = analysisCtx?.usageArtifacts as UsageArtifacts | undefined;
  const weeklyExhaustionArtifactsFromCtx = analysisCtx?.weeklyExhaustion as { weeks?: Array<{ weekNumber: number; usersExhaustedInWeek: number; startDate: string; endDate: string }>; totalUsersExhausted?: number } | undefined;
  const featureUsageArtifactsFromCtx = analysisCtx?.featureUsageArtifacts as FeatureUsageArtifacts | undefined;

  // Prefer explicitly passed artifacts (future-proof for isolated component tests) then context.
  const quotaArtifactsEff = quotaArtifacts || quotaArtifactsFromCtx;
  const usageArtifactsEff = usageArtifacts || usageArtifactsFromCtx;
  const featureUsageArtifactsEff = featureUsageArtifacts || featureUsageArtifactsFromCtx;
  const weeklyExhaustionArtifactsEff = weeklyExhaustionArtifacts || weeklyExhaustionArtifactsFromCtx;
  
  const insightsData = useMemo(() => {
    if (usageArtifactsEff && quotaArtifactsEff) {
      return buildConsumptionCategoriesFromArtifacts(usageArtifactsEff, quotaArtifactsEff);
    }
    return categorizeUserConsumption(userData, processedData);
  }, [userData, processedData, usageArtifactsEff, quotaArtifactsEff]);

  const featureUtilization = useMemo(() => {
    if (featureUsageArtifactsEff) {
      return buildFeatureUtilizationFromArtifacts(featureUsageArtifactsEff);
    }
    if (usageArtifactsEff) {
      let totalCR=0,totalCA=0,totalSpark=0;
      const crUsers=new Set<string>(), caUsers=new Set<string>(), sparkUsers=new Set<string>();
      for (const u of usageArtifactsEff.users) {
        for (const [model, qty] of Object.entries(u.modelBreakdown)) {
          const lower = model.toLowerCase();
          if (lower.includes('code review')) { totalCR += qty; crUsers.add(u.user); }
          if (lower.includes('coding agent') || lower.includes('padawan')) { totalCA += qty; caUsers.add(u.user); }
          if (lower.includes('spark')) { totalSpark += qty; sparkUsers.add(u.user); }
        }
      }
      const avg = (t:number,c:number)=> c>0 ? t/c : 0;
      return {
        codeReview: { totalSessions: totalCR, averagePerUser: avg(totalCR, crUsers.size), userCount: crUsers.size },
        codingAgent: { totalSessions: totalCA, averagePerUser: avg(totalCA, caUsers.size), userCount: caUsers.size },
        spark: { totalSessions: totalSpark, averagePerUser: avg(totalSpark, sparkUsers.size), userCount: sparkUsers.size }
      };
    }
    return calculateFeatureUtilization(processedData);
  }, [processedData, usageArtifactsEff, featureUsageArtifactsEff]);

  const weeklyExhaustion = useMemo<WeeklyExhaustionData>(() => {
    if (weeklyExhaustionArtifactsEff && Array.isArray(weeklyExhaustionArtifactsEff.weeks)) {
      const weeksArr = weeklyExhaustionArtifactsEff.weeks;
      const w1 = weeksArr.find((w: { weekNumber: number }) => w.weekNumber === 1)?.usersExhaustedInWeek || 0;
      const w2 = weeksArr.find((w: { weekNumber: number }) => w.weekNumber === 2)?.usersExhaustedInWeek || 0;
      const w3 = weeksArr.find((w: { weekNumber: number }) => w.weekNumber === 3)?.usersExhaustedInWeek || 0;
      const w4 = weeksArr.find((w: { weekNumber: number }) => w.weekNumber === 4)?.usersExhaustedInWeek || 0;
      const arr = (n: number) => Array.from({ length: n }, (_, i) => `user-${i+1}`);
      return {
        week1Exhausted: arr(w1),
        week2Exhausted: arr(w2),
        week3Exhausted: arr(w3),
        week4Exhausted: arr(w4),
        currentPeriodOnly: true
      };
    }
    // Fallback placeholder (artifact missing) - no legacy computation.
    return {
      week1Exhausted: [],
      week2Exhausted: [],
      week3Exhausted: [],
      week4Exhausted: [],
      currentPeriodOnly: true
    };
  }, [weeklyExhaustionArtifactsEff]);

  // Compute unutilized value (only for users with numeric quotas)
  const averageUnusedValueUSD = useMemo(() => calculateUnusedValue(insightsData.averageUsers), [insightsData]);
  const lowUnusedValueUSD = useMemo(() => calculateUnusedValue(insightsData.lowAdoptionUsers), [insightsData]);

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Consumption Insights</h2>
          <p className="text-sm text-[#636c76] mt-1">
            Usage patterns, adoption levels, and recommendations
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#636c76] bg-white border border-[#d1d9e0] rounded-md hover:bg-[#f6f8fa] hover:border-[#d1d9e0] transition-colors duration-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
        )}
      </div>

      {/* User Categories Summary */}
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">User Categories</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Breakdown by consumption patterns
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Power Users */}
            <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[#2da44e] uppercase tracking-[0.05em]">Power Users</p>
                  <p className="text-2xl font-semibold text-[#1f2328] mt-1">
                    {insightsData.powerUsers.length}
                  </p>
                  <p className="text-xs text-[#2da44e] mt-0.5">90%+ quota usage</p>
                </div>
                <div className="w-8 h-8 bg-[#2da44e] rounded-md flex items-center justify-center text-white text-sm font-bold">
                  ✓
                </div>
              </div>
            </div>

            {/* Average Users */}
            <div className="p-4 bg-[#fffbeb] border border-[#fde68a] rounded-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[#d97706] uppercase tracking-[0.05em]">Average Users</p>
                  <p className="text-2xl font-semibold text-[#1f2328] mt-1">
                    {insightsData.averageUsers.length}
                  </p>
                  <p className="text-xs text-[#d97706] mt-0.5">45–90% usage</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#d97706]">Unutilized</p>
                  <p className="text-sm font-medium text-[#1f2328]">${averageUnusedValueUSD.toFixed(0)}</p>
                </div>
              </div>
            </div>

            {/* Low Adoption */}
            <div className="p-4 bg-[#fef2f2] border border-[#fecdd3] rounded-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[#cf222e] uppercase tracking-[0.05em]">Low Adoption</p>
                  <p className="text-2xl font-semibold text-[#1f2328] mt-1">
                    {insightsData.lowAdoptionUsers.length}
                  </p>
                  <p className="text-xs text-[#cf222e] mt-0.5">&lt;45% usage</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#cf222e]">Unutilized</p>
                  <p className="text-sm font-medium text-[#1f2328]">${lowUnusedValueUSD.toFixed(0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="space-y-8">
        {/* Power Users Table */}
        {insightsData.powerUsers.length > 0 && (
          <ExpandableSection
            id="power-users"
            title={`Power Users - High Usage (${CONSUMPTION_THRESHOLDS.powerMinPct}%+ of quota)`}
            expanded={isPowerUsersExpanded}
            onToggle={() => setIsPowerUsersExpanded(e => !e)}
          >
            <UserCategoryTable users={insightsData.powerUsers} color="green" />
          </ExpandableSection>
        )}

        {/* Average Users Table */}
        {insightsData.averageUsers.length > 0 && (
          <ExpandableSection
            id="average-users"
            title={`Average Users - Moderate Usage (${CONSUMPTION_THRESHOLDS.averageMinPct}-${CONSUMPTION_THRESHOLDS.powerMinPct}%)`}
            expanded={isAverageUsersExpanded}
            onToggle={() => setIsAverageUsersExpanded(e => !e)}
          >
            <UserCategoryTable users={insightsData.averageUsers} color="yellow" />
          </ExpandableSection>
        )}

        {/* Low Adoption Users Table */}
        {insightsData.lowAdoptionUsers.length > 0 && (
          <ExpandableSection
            id="low-users"
            title={`Low Adoption Users - Under-utilized (<${CONSUMPTION_THRESHOLDS.averageMinPct}%)`}
            expanded={isLowAdoptionExpanded}
            onToggle={() => setIsLowAdoptionExpanded(e => !e)}
          >
            <UserCategoryTable users={insightsData.lowAdoptionUsers} color="red" limit={20} />
            {insightsData.lowAdoptionUsers.length > 20 && (
              <div className="px-6 py-3 bg-[#f6f8fa] text-sm text-[#636c76] text-center">
                Showing top 20 of {insightsData.lowAdoptionUsers.length} users
              </div>
            )}
          </ExpandableSection>
        )}
      </div>

      {/* Feature Utilization Block */}
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">Feature Utilization</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Specialized Copilot feature usage
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Code Review */}
            <div className="p-4 bg-white border border-[#d1d9e0] rounded-md border-l-[3px] border-l-blue-500">
              <p className="text-xs font-medium text-[#636c76] uppercase tracking-[0.05em] mb-2">Code Review</p>
              <p className="text-2xl font-semibold text-[#1f2328]">
                {Math.round(featureUtilization.codeReview.totalSessions)}
              </p>
              <p className="text-xs text-[#636c76] mt-1">
                {featureUtilization.codeReview.averagePerUser.toFixed(1)} avg per user • {featureUtilization.codeReview.userCount} users
              </p>
            </div>

            {/* Coding Agent */}
            <div className="p-4 bg-white border border-[#d1d9e0] rounded-md border-l-[3px] border-l-purple-500">
              <p className="text-xs font-medium text-[#636c76] uppercase tracking-[0.05em] mb-2">Coding Agent</p>
              <p className="text-2xl font-semibold text-[#1f2328]">
                {Math.round(featureUtilization.codingAgent.totalSessions)}
              </p>
              <p className="text-xs text-[#636c76] mt-1">
                {featureUtilization.codingAgent.averagePerUser.toFixed(1)} avg per user • {featureUtilization.codingAgent.userCount} users
              </p>
            </div>

            {/* Spark */}
            <div className="p-4 bg-white border border-[#d1d9e0] rounded-md border-l-[3px] border-l-[#6366f1]">
              <p className="text-xs font-medium text-[#636c76] uppercase tracking-[0.05em] mb-2">Spark</p>
              <p className="text-2xl font-semibold text-[#1f2328]">
                {Math.round(featureUtilization.spark.totalSessions)}
              </p>
              <p className="text-xs text-[#636c76] mt-1">
                {featureUtilization.spark.averagePerUser.toFixed(1)} avg per user • {featureUtilization.spark.userCount} users
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Quota Exhaustion */}
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">Weekly Quota Exhaustion</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Users exhausting quota before day 28
          </p>
        </div>
        <div className="px-5 py-4">
          <WeeklyQuotaExhaustion
            weeklyExhaustion={weeklyExhaustion}
            totalUsers={userData.length}
          />
        </div>
      </div>

      {/* Recommendations & Advisory */}
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">Recommendations</h3>
          <p className="text-xs text-[#636c76] mt-0.5">
            Actionable optimization insights
          </p>
        </div>
        <div className="px-5 py-4">
          <AdvisorySection
            userData={userData}
            processedData={processedData}
            weeklyExhaustion={weeklyExhaustion}
          />
        </div>
      </div>
    </div>
  );
}
