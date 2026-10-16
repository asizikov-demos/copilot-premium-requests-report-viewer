'use client';

import { ArrowRightIcon } from '@primer/octicons-react';
import { Button } from '@primer/react';

import type { Advisory } from '@/utils/analytics/advisory';

interface AdvisorySectionProps {
  advisories: Advisory[];
  onExplore: () => void;
}

export function AdvisorySection({ advisories, onExplore }: AdvisorySectionProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-(--borderColor-default) bg-(--bgColor-default)">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--borderColor-default) px-5 py-4">
        <h3 className="text-sm font-semibold text-(--fgColor-default)">Worth a closer look</h3>
        <span className="text-xs text-(--fgColor-muted)">{advisories.length} {advisories.length === 1 ? 'recommendation' : 'recommendations'}</span>
      </div>
      {advisories.length === 0 ? (
        <p className="p-5 text-sm leading-6 text-(--fgColor-muted)">No adoption recommendations for this period. Consumption alone is not a measure of productivity.</p>
      ) : (
        <div className="divide-y divide-(--borderColor-default)">
          {advisories.map(advisory => (
            <details key={advisory.type}>
              <summary className="cursor-pointer px-5 py-4 text-sm text-(--fgColor-default) hover:bg-(--control-transparent-bgColor-hover)">
                {advisory.title}<span className="ml-2 text-xs text-(--fgColor-muted)">{advisory.affectedUsers} users</span>
              </summary>
              <div className="space-y-3 px-5 pb-5 text-sm leading-6 text-(--fgColor-muted)">
                <p>{advisory.description}</p>
                {advisory.estimatedImpact && <p>{advisory.estimatedImpact}</p>}
                <p className="font-medium text-(--fgColor-default)">Suggested next steps</p>
                <ul className="list-disc space-y-1 pl-5">{advisory.actionItems.map(action => <li key={action}>{action}</li>)}</ul>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="small" trailingVisual={ArrowRightIcon} onClick={onExplore}>Explore low-adoption users</Button>
                  {advisory.documentationLink && <a href={advisory.documentationLink} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-(--fgColor-accent) hover:underline">View documentation &rarr;</a>}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
