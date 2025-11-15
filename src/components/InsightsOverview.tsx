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
  onBack: () => void;
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
          <h2 className="text-2xl font-bold text-gray-900">Consumption Insights</h2>
          <p className="text-sm text-gray-600 mt-1">
            User consumption patterns, adoption levels, and recommendations
          </p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ← Back to Overview
        </button>
      </div>

      {/* User Categories Summary */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">User Categories</h3>
          <p className="text-sm text-gray-500 mt-1">
            Breakdown of users by consumption patterns
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">✓</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-green-800">Power Users</h3>
              <p className="text-sm text-green-600">High Usage (90%+ of quota)</p>
              <p className="text-2xl font-bold text-green-900 mt-2">
                {insightsData.powerUsers.length} users
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">~</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-yellow-800">Average Users</h3>
                <p className="text-sm text-yellow-600">Moderate Usage (45-90%)</p>
                <p className="text-2xl font-bold text-yellow-900 mt-2">
                  {insightsData.averageUsers.length} users
                </p>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-lg font-semibold text-yellow-800">Unutilized Value</h3>
              <p className="text-sm font-bold text-yellow-900">
                Total: ${averageUnusedValueUSD.toFixed(2)}
              </p>
              <p className="text-xs text-yellow-700">
                Average per user: ${insightsData.averageUsers.length > 0 ? (averageUnusedValueUSD / insightsData.averageUsers.length).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">!</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-red-800">Low Adoption Users</h3>
                <p className="text-sm text-red-600">Under-utilized (under 45%)</p>
                <p className="text-2xl font-bold text-red-900 mt-2">
                  {insightsData.lowAdoptionUsers.length} users
                </p>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-lg font-semibold text-red-800">Unutilized Value</h3>
              <p className="text-sm font-bold text-red-900">
                Total: ${lowUnusedValueUSD.toFixed(2)}
              </p>
              <p className="text-xs text-red-700">
                Average per user: ${insightsData.lowAdoptionUsers.length > 0 ? (lowUnusedValueUSD / insightsData.lowAdoptionUsers.length).toFixed(2) : '0.00'}
              </p>
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
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                Showing top 20 of {insightsData.lowAdoptionUsers.length} users
              </div>
            )}
          </ExpandableSection>
        )}
      </div>

      {/* Feature Utilization Block */}
      <div className="bg-white shadow rounded-lg overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Feature Utilization</h3>
          <p className="text-sm text-gray-600 mt-1">
            Usage statistics for specialized Copilot features
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Code Review Sessions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-blue-800">Code Review Sessions</h4>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-blue-900">
                      {Math.round(featureUtilization.codeReview.totalSessions)} reviews
                    </p>
                    <p className="text-sm text-blue-600 mt-1">
                      Average per Code Review User: {featureUtilization.codeReview.averagePerUser.toFixed(1)} reviews
                    </p>
                    <p className="text-xs text-blue-500 mt-1">
                      {featureUtilization.codeReview.userCount} users
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Copilot Coding Agent Sessions */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-purple-800">Copilot Coding Agent Sessions</h4>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-purple-900">
                      {Math.round(featureUtilization.codingAgent.totalSessions)} sessions
                    </p>
                    <p className="text-sm text-purple-600 mt-1">
                      Average per Coding Agent User: {featureUtilization.codingAgent.averagePerUser.toFixed(1)} sessions
                    </p>
                    <p className="text-xs text-purple-500 mt-1">
                      {featureUtilization.codingAgent.userCount} users
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Spark Sessions */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-orange-800">Spark Sessions</h4>
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-orange-900">
                      {Math.round(featureUtilization.spark.totalSessions)} sessions
                    </p>
                    <p className="text-sm text-orange-600 mt-1">
                      Average per Spark User: {featureUtilization.spark.averagePerUser.toFixed(1)} sessions
                    </p>
                    <p className="text-xs text-orange-500 mt-1">
                      {featureUtilization.spark.userCount} users
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Quota Exhaustion */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Weekly Quota Exhaustion Pattern
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Users who exhausted their quota before day 28 of the month
          </p>
        </div>
        <div className="px-4 sm:px-6 py-6">
          <WeeklyQuotaExhaustion
            weeklyExhaustion={weeklyExhaustion}
            totalUsers={userData.length}
          />
        </div>
      </div>

      {/* Recommendations & Advisory */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recommendations & Advisory</h3>
            <p className="text-sm text-gray-500 mt-1">
              Actionable insights to optimize your GitHub Copilot deployment
            </p>
        </div>
        <div className="px-4 sm:px-6 py-6">
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
