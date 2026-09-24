'use client';

import type { Advisory } from '@/utils/analytics/advisory';

interface AdvisorySectionProps {
  advisories: Advisory[];
  onExplore: () => void;
}

export function AdvisorySection({ advisories, onExplore }: AdvisorySectionProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-[#d1d9e0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d1d9e0] px-5 py-4">
        <h3 className="text-sm font-semibold text-[#1f2328]">Worth a closer look</h3>
        <span className="text-xs text-[#636c76]">{advisories.length} {advisories.length === 1 ? 'recommendation' : 'recommendations'}</span>
      </div>
      {advisories.length === 0 ? (
        <p className="p-5 text-sm leading-6 text-[#636c76]">No adoption recommendations for this period. Consumption alone is not a measure of productivity.</p>
      ) : (
        <div className="divide-y divide-[#d1d9e0]">
          {advisories.map(advisory => (
            <details key={advisory.type}>
              <summary className="cursor-pointer px-5 py-4 text-sm text-[#1f2328] hover:bg-[#f6f8fa]">
                {advisory.title}<span className="ml-2 text-xs text-[#636c76]">{advisory.affectedUsers} users</span>
              </summary>
              <div className="space-y-3 px-5 pb-5 text-sm leading-6 text-[#636c76]">
                <p>{advisory.description}</p>
                {advisory.estimatedImpact && <p>{advisory.estimatedImpact}</p>}
                <p className="font-medium text-[#1f2328]">Suggested next steps</p>
                <ul className="list-disc space-y-1 pl-5">{advisory.actionItems.map(action => <li key={action}>{action}</li>)}</ul>
                <div className="flex flex-wrap items-center gap-4">
                  <button onClick={onExplore} className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 text-xs font-medium text-[#1f2328] hover:bg-[#f6f8fa]">Explore low-adoption users &rarr;</button>
                  {advisory.documentationLink && <a href={advisory.documentationLink} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#0969da] hover:underline">View documentation &rarr;</a>}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
