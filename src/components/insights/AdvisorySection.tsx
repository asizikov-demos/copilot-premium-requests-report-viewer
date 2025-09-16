'use client';

import { Advisory, generateAdvisories } from '@/utils/analytics/advisory';
import { UserSummary } from '@/utils/analytics/transformations';
import { ProcessedData } from '@/types/csv';
import { WeeklyExhaustionData } from '@/utils/analytics/weeklyQuota';

interface AdvisorySectionProps {
  userData: UserSummary[];
  processedData: ProcessedData[];
  weeklyExhaustion: WeeklyExhaustionData;
}

// Highlight key phrases inside advisory descriptions without needing HTML in data layer
function renderDescription(advisory: Advisory) {
  const phrase = 'before day 21 of the month';
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
      container: 'bg-red-50 border-red-200',
      title: 'text-red-900',
      description: 'text-red-700',
      icon: '⚠️'
    },
    medium: {
      container: 'bg-yellow-50 border-yellow-200',
      title: 'text-yellow-900',
      description: 'text-yellow-700',
      icon: '💡'
    },
    low: {
      container: 'bg-blue-50 border-blue-200',
      title: 'text-blue-900',
      description: 'text-blue-700',
      icon: 'ℹ️'
    }
  };
  
  const typeIcons = {
    perRequestBilling: '💳',
    training: '📚',
    optimization: '⚙️'
  };
  
  const styles = severityStyles[advisory.severity];
  const typeIcon = typeIcons[advisory.type];
  
  return (
    <div className={`border rounded-lg p-6 ${styles.container}`}>
      <div className="flex items-start">
        <div className="flex items-center mr-4">
          <span className="text-2xl mr-2">{typeIcon}</span>
          <span className="text-lg">{styles.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h4 className={`text-lg font-medium ${styles.title} flex-1`}>
              {advisory.title}
            </h4>
            <span className={`ml-4 px-2 py-1 text-xs font-medium rounded-full bg-white bg-opacity-75 ${styles.description} flex-shrink-0`}>
              {advisory.affectedUsers} users
            </span>
          </div>
          
          <p className={`text-sm mb-3 ${styles.description}`}>
            {renderDescription(advisory)}
          </p>
          
          {advisory.estimatedImpact && (
            <div className={`text-sm font-medium mb-4 px-3 py-2 bg-white bg-opacity-50 rounded ${styles.description}`}>
              💰 {advisory.estimatedImpact}
            </div>
          )}
          
          <div className="mb-4">
            <h5 className={`text-sm font-medium mb-2 ${styles.title}`}>
              Recommended Actions:
            </h5>
            <ul className={`list-disc list-inside space-y-1 text-sm ${styles.description} pl-2`}>
              {advisory.actionItems.map((item, i) => (
                <li key={i} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
          
          {advisory.documentationLink && (
            <div className="pt-2 border-t border-gray-200 border-opacity-50">
              <a
                href={advisory.documentationLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center text-sm font-medium hover:underline ${styles.title}`}
              >
                📖 View Documentation
                <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoActionRequired() {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <div className="flex items-center">
        <span className="text-3xl mr-4">✅</span>
        <div>
          <h4 className="text-lg font-medium text-green-900 mb-1">
            No Action Required
          </h4>
          <p className="text-sm text-green-700">
            Your organization&apos;s GitHub Copilot usage is well-balanced. Usage patterns look healthy with good adoption rates and reasonable quota consumption.
          </p>
          <div className="mt-3 text-xs text-green-600">
            <div className="flex items-center space-x-4">
              <span>📊 Balanced consumption patterns</span>
              <span>👥 Healthy user adoption</span>
              <span>💰 Optimized quota usage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdvisorySection({ 
  userData, 
  processedData, 
  weeklyExhaustion 
}: AdvisorySectionProps) {
  const advisories = generateAdvisories(userData, processedData, weeklyExhaustion);
  
  if (advisories.length === 0) {
    return <NoActionRequired />;
  }
  
  return (
    <div className="space-y-6">
      {advisories.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-xl mr-3">📋</span>
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">
                {advisories.length} Recommendations Found
              </h4>
              <p className="text-xs text-blue-700">
                Review the recommendations below to optimize your GitHub Copilot deployment and improve user experience.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        {advisories.map((advisory, index) => (
          <AdvisoryCard key={index} advisory={advisory} />
        ))}
      </div>
    </div>
  );
}