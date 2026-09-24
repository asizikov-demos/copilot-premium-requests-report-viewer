'use client';

import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { AnalysisContext } from '@/context/AnalysisContext';
import type { ProcessedData } from '@/types/csv';
import type { UserSummary } from '@/utils/analytics';
import { buildAdvisoriesFromCategories } from '@/utils/analytics/advisory';
import { categorizeUserConsumption, CONSUMPTION_THRESHOLDS } from '@/utils/analytics/insights';
import { formatDecimalQuantity } from '@/utils/formatters';
import { buildConsumptionCategoriesFromArtifacts, buildFeatureUtilizationFromArtifacts } from '@/utils/ingestion/analytics';
import type { QuotaArtifacts, UsageArtifacts, FeatureUsageArtifacts } from '@/utils/ingestion/types';

import { UserCategoryTable } from './analysis/UserCategoryTable';
import { AdvisorySection } from './insights/AdvisorySection';

interface InsightsOverviewProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  quotaArtifacts?: QuotaArtifacts;
  usageArtifacts?: UsageArtifacts;
  featureUsageArtifacts: FeatureUsageArtifacts;
}

type Category = 'powerUsers' | 'averageUsers' | 'lowAdoptionUsers';

const categories: { id: Category; title: string; threshold: string; dot: string; description: string }[] = [
  { id: 'powerUsers', title: 'Power users', threshold: `${CONSUMPTION_THRESHOLDS.powerMinPct}%+ of quota`, dot: 'bg-[#2da44e]', description: 'High consumption. Learn from established workflows and share useful practices.' },
  { id: 'averageUsers', title: 'Average users', threshold: `${CONSUMPTION_THRESHOLDS.averageMinPct}% to <${CONSUMPTION_THRESHOLDS.powerMinPct}%`, dot: 'bg-[#d97706]', description: 'Moderate consumption. Look for opportunities to broaden useful workflows.' },
  { id: 'lowAdoptionUsers', title: 'Low adoption', threshold: `<${CONSUMPTION_THRESHOLDS.averageMinPct}% of quota`, dot: 'bg-[#cf222e]', description: 'Low consumption is a conversation starter, not a measure of productivity.' },
];

export function InsightsOverview({ userData, processedData, quotaArtifacts, usageArtifacts, featureUsageArtifacts }: InsightsOverviewProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const analysisContext = useContext(AnalysisContext);
  const effectiveQuota = quotaArtifacts ?? analysisContext?.quotaArtifacts;
  const effectiveUsage = usageArtifacts ?? analysisContext?.usageArtifacts;
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const returnTarget = useRef<HTMLButtonElement | null>(null);
  const returnCategory = useRef<Category | null>(null);

  const insightsData = useMemo(() => effectiveUsage && effectiveQuota
    ? buildConsumptionCategoriesFromArtifacts(effectiveUsage, effectiveQuota)
    : categorizeUserConsumption(userData, processedData),
  [effectiveUsage, effectiveQuota, userData, processedData]);
  const featureUtilization = useMemo(() => buildFeatureUtilizationFromArtifacts(featureUsageArtifacts), [featureUsageArtifacts]);
  const totalUsers = effectiveUsage?.userCount ?? userData.length;
  const classifiedUsers = categories.reduce((total, category) => total + insightsData[category.id].length, 0);
  const unknownQuotaUsers = totalUsers - classifiedUsers;
  const advisories = useMemo(() => buildAdvisoriesFromCategories(insightsData.lowAdoptionUsers, totalUsers), [insightsData, totalUsers]);
  const monthsInScope = analysisContext?.dailyBucketsArtifacts?.months
    ?? Array.from(new Set(processedData.map(row => row.monthKey)));
  const selected = categories.find(category => category.id === selectedCategory);
  const features = [
    { name: 'Code Review', ...featureUtilization.codeReview },
    { name: 'Cloud Agent', ...featureUtilization.codingAgent },
    { name: 'Spark', ...featureUtilization.spark },
    { name: 'Code Quality', ...featureUtilization.codeQuality },
  ];

  useEffect(() => {
    if (selectedCategory) detailHeading.current?.focus();
    else returnTarget.current?.focus();
  }, [selectedCategory]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1f2328]">Consumption Insights</h2>
        <p className="mt-1.5 text-sm text-[#636c76]">Understand consumption. Find the right follow-up.</p>
      </div>
      {monthsInScope.length > 1 ? (
        <div className="rounded-md border border-[#d1d9e0] bg-[#f6f8fa] p-5 text-sm text-[#636c76]">
          Select one billing month to compare AI Credit consumption with monthly quotas.
        </div>
      ) : selected && selectedCategory ? (
        <div className="space-y-4">
          <button onClick={() => setSelectedCategory(null)} className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-sm font-medium text-[#636c76] hover:bg-[#f6f8fa]">
            &larr; Back to overview
          </button>
          <section className="overflow-hidden rounded-md border border-[#d1d9e0] bg-white">
            <div className="border-b border-[#d1d9e0] px-5 py-4">
              <h3 ref={detailHeading} tabIndex={-1} className="text-sm font-semibold text-[#1f2328]">{selected.title}</h3>
              <p className="mt-1 text-xs text-[#636c76]">{selected.description}</p>
            </div>
            <UserCategoryTable key={selectedCategory} users={insightsData[selectedCategory]} />
          </section>
        </div>
      ) : (
        <>
          <div className="grid gap-px overflow-hidden rounded-md border border-[#d1d9e0] bg-[#d1d9e0] sm:grid-cols-3">
            {categories.map(category => (
              <button
                key={category.id}
                ref={element => { if (element && returnCategory.current === category.id) returnTarget.current = element; }}
                onClick={() => { returnCategory.current = category.id; setSelectedCategory(category.id); }}
                className="group bg-white p-5 text-left transition-colors hover:bg-[#fcfdff]"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-[#636c76]"><span className={`h-2 w-2 rounded-full ${category.dot}`} />{category.title}</span>
                <span className="mt-3 flex items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums text-[#1f2328]">{insightsData[category.id].length}</span><span className="text-xs text-[#636c76]">/ {totalUsers} users</span></span>
                <span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#636c76]">{category.threshold}<span className="text-[#0969da] group-hover:underline">Explore &rarr;</span></span>
              </button>
            ))}
          </div>
          {unknownQuotaUsers > 0 && <p className="text-xs text-[#636c76]">{unknownQuotaUsers} {unknownQuotaUsers === 1 ? 'user has' : 'users have'} an unknown quota and {unknownQuotaUsers === 1 ? 'is' : 'are'} not included in consumption groups.</p>}
          {totalUsers === 0 && <p className="text-sm text-[#636c76]">No named-user consumption is available for this period.</p>}
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className="min-w-0 overflow-hidden rounded-md border border-[#d1d9e0] bg-white">
              <div className="border-b border-[#d1d9e0] px-5 py-4">
                <h3 className="text-sm font-semibold text-[#1f2328]">Feature reach</h3>
                <p className="mt-1 text-xs text-[#636c76]">How many people use each specialized feature</p>
              </div>
              <div className="divide-y divide-[#d1d9e0] px-5">
                {features.map(feature => (
                  <div key={feature.name} className="py-4">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-medium text-[#1f2328]">{feature.name}</span><span className="text-xs text-[#636c76]"><strong className="font-medium text-[#1f2328]">{feature.userCount}</strong> / {totalUsers} users</span></div>
                    <svg viewBox="0 0 240 6" preserveAspectRatio="none" className="h-1.5 w-full rounded-full" role="img" aria-label={`${feature.name}: ${feature.userCount} of ${totalUsers} users`}>
                      <rect width="240" height="6" className="fill-[#e8ecf0]" />
                      <rect width={totalUsers > 0 ? Math.min(feature.userCount / totalUsers, 1) * 240 : 0} height="6" className="fill-[#6366f1]" />
                    </svg>
                    <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-[#636c76]"><span>{formatDecimalQuantity(feature.totalCredits)} AI Credits</span><span>{feature.averagePerUser.toFixed(1)} credits / active user</span></div>
                  </div>
                ))}
                <p className="py-4 text-xs leading-5 text-[#636c76]">Users may use multiple features. Unattributed usage is included in credit totals, not user counts.</p>
              </div>
            </section>
            <AdvisorySection advisories={advisories} onExplore={() => { returnCategory.current = 'lowAdoptionUsers'; setSelectedCategory('lowAdoptionUsers'); }} />
          </div>
        </>
      )}
    </div>
  );
}
