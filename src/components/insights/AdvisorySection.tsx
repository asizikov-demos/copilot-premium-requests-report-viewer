"use client";

import { useContext, useMemo } from 'react';
import type { ProcessedData } from '@/types/csv';
import { Advisory, generateAdvisories } from '@/utils/analytics/advisory';
import { AnalysisContext } from '@/context/AnalysisContext';
import { UserSummary } from '@/utils/analytics/types';
import { buildAdvisoriesFromArtifacts, buildConsumptionCategoriesFromArtifacts } from '@/utils/ingestion/analytics';
import type { WeeklyQuotaExhaustionBreakdown } from '@/utils/ingestion/analytics';
import { QuotaArtifacts, UsageArtifacts } from '@/utils/ingestion/types';

interface AdvisorySectionProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  weeklyExhaustion: WeeklyQuotaExhaustionBreakdown;
}

// Highlight key phrases inside advisory descriptions without needing HTML in data layer
function renderDescription(advisory: Advisory) {
  const phrase = 'before day 28 of the month';
  if (advisory.description.includes(phrase)) {
    const parts = advisory.description.split(phrase);
    return (
      <>
        {parts[0]}
        <strong className="font-semibold">{phrase}</strong>
        {parts.slice(1).join(phrase)}
      </>
    );
  }
  return advisory.description;
}

function AdvisoryCard({ advisory }: { advisory: Advisory }) {
  const severityStyles = {
    high: {
      container: 'bg-[#fef2f2] border-[#fecdd3]',
      title: 'text-[#cf222e]',
      description: 'text-[#cf222e]',
    },
    medium: {
      container: 'bg-[#fffbeb] border-[#fde68a]',
      title: 'text-[#d97706]',
      description: 'text-[#d97706]',
    },
    low: {
      container: 'bg-[#eef2ff] border-[#c7d2fe]',
      title: 'text-[#6366f1]',
      description: 'text-[#6366f1]',
    }
  };
  
  const styles = severityStyles[advisory.severity];
  
  return (
    <div className={`border rounded-md p-5 ${styles.container}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className={`text-sm font-medium ${styles.title}`}>
          {advisory.title}
        </h4>
        <span className={`ml-3 px-2 py-0.5 text-xs font-medium rounded-md bg-white border border-[#d1d9e0] ${styles.description}`}>
          {advisory.affectedUsers} users
        </span>
      </div>
      
      <p className={`text-xs mb-3 opacity-80 ${styles.description}`}>
        {renderDescription(advisory)}
      </p>
      
      {advisory.estimatedImpact && (
        <div className={`text-xs font-medium mb-3 px-3 py-2 bg-white/80 rounded-md border border-[#d1d9e0] ${styles.description}`}>
          {advisory.estimatedImpact}
        </div>
      )}
      
      <div className="mb-3">
        <h5 className={`text-xs font-medium mb-1.5 ${styles.title}`}>
          Recommended Actions
        </h5>
        <ul className={`space-y-1 text-xs ${styles.description}`}>
          {advisory.actionItems.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-xs opacity-60">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {advisory.documentationLink && (
        <a
          href={advisory.documentationLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center text-xs font-medium hover:underline ${styles.title}`}
        >
          View Documentation
          <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

function NoActionRequired() {
  return (
    <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-md p-5">
      <h4 className="text-sm font-medium text-[#2da44e] mb-1">
        No Action Required
      </h4>
      <p className="text-xs text-[#2da44e] opacity-80">
        Usage patterns are healthy with good adoption and balanced quota consumption.
      </p>
    </div>
  );
}

export function AdvisorySection({
  userData,
  processedData,
  weeklyExhaustion
}: AdvisorySectionProps) {
  const analysisCtx = useContext(AnalysisContext);
  const quotaArtifacts = analysisCtx?.quotaArtifacts as QuotaArtifacts | undefined;
  const usageArtifacts = analysisCtx?.usageArtifacts as UsageArtifacts | undefined;
  const weeklyExhaustionEff = (analysisCtx?.weeklyExhaustion as WeeklyQuotaExhaustionBreakdown | undefined) ?? weeklyExhaustion;

  const advisories = useMemo(() => {
    if (usageArtifacts && quotaArtifacts) {
      const categories = buildConsumptionCategoriesFromArtifacts(usageArtifacts, quotaArtifacts);
      return buildAdvisoriesFromArtifacts(categories, weeklyExhaustionEff, usageArtifacts, quotaArtifacts);
    }
    return generateAdvisories(userData, processedData, weeklyExhaustionEff);
  }, [usageArtifacts, quotaArtifacts, userData, processedData, weeklyExhaustionEff]);
  
  if (advisories.length === 0) {
    return <NoActionRequired />;
  }
  
  return (
    <div className="space-y-4">
      {advisories.length > 1 && (
        <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-md p-4">
          <h4 className="text-xs font-medium text-[#6366f1] mb-0.5">
            {advisories.length} Recommendations
          </h4>
          <p className="text-xs text-[#6366f1] opacity-80">
            Review these to optimize your deployment.
          </p>
        </div>
      )}
      
      <div className="space-y-3">
        {advisories.map((advisory, index) => (
          <AdvisoryCard key={index} advisory={advisory} />
        ))}
      </div>
    </div>
  );
}
