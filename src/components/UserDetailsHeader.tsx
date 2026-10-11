'use client';

import React from 'react';

import type { UserHeaderSummary } from '@/utils/userHeaderSummary';
import { formatCurrency } from '@/utils/formatters';

export interface UserDetailsHeaderProps {
  user: string;
  planName: string;
  summary: UserHeaderSummary;
  onBack: () => void;
  onCopyUser: () => void;
}

const formatCredits = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const redIfPositive = (value: number | null) =>
  value !== null && value > 0 ? 'text-red-600' : 'text-[#1f2328]';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-[#636c76] uppercase tracking-[0.05em]">{children}</p>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'text-[#1f2328]',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-[#636c76]">{sub}</p>}
    </div>
  );
}

export function UserDetailsHeader({ user, planName, summary, onBack, onCopyUser }: UserDetailsHeaderProps) {
  const details = [
    { label: 'Plan', value: planName },
    { label: 'Organizations', value: summary.organizations.join(', ') || '—' },
    { label: 'Cost centers', value: summary.costCenters.join(', ') || '—' },
    { label: 'Cloud agent', value: summary.cloudAgentUsed ? 'Used' : 'Not used' },
    { label: 'Code review agent', value: summary.codeReviewUsed ? 'Used' : 'Not used' },
  ];
  const daysPercent = summary.daysInPeriod
    ? Math.min(100, (summary.daysActive / summary.daysInPeriod) * 100)
    : null;

  return (
    <div className="bg-white border border-[#d1d9e0] rounded-md p-5">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <button
              type="button"
              onClick={onBack}
              className="text-2xl font-semibold tracking-tight text-[#0969da] hover:underline focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
            >
              users
            </button>
          </li>
          <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-[#8c959f]">/</li>
          <li>
            <button
              type="button"
              onClick={onCopyUser}
              title="Click to copy username"
              className="text-2xl font-semibold tracking-tight text-[#1f2328] hover:text-indigo-600 transition-colors duration-150 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm inline-flex items-center gap-2 group"
            >
              {user}
              <svg
                className="w-5 h-5 text-[#636c76] group-hover:text-indigo-600 transition-colors duration-150"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
            </button>
          </li>
        </ol>
      </nav>

      <div className="grid md:grid-cols-[280px_1fr] gap-x-10 gap-y-6 mt-4">
        <dl className="space-y-2 md:border-r md:border-[#d1d9e0] md:pr-6">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs text-[#636c76]">{detail.label}</dt>
              <dd className="text-sm text-[#1f2328] break-words">{detail.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 content-start">
          <div className="col-span-2">
            <Label>Total consumption</Label>
            {summary.totalCost !== null ? (
              <>
                <p className="display-heading text-4xl font-semibold text-[#1f2328] tabular-nums">
                  {formatCurrency(summary.totalCost)}
                </p>
                <p className="text-xs text-[#636c76]">
                  of which additional consumption:{' '}
                  <b className={redIfPositive(summary.additionalCost)}>
                    {formatCurrency(summary.additionalCost ?? 0)}
                  </b>
                </p>
              </>
            ) : (
              <p className="text-sm text-[#636c76] mt-1">Not available in this export</p>
            )}
          </div>

          {summary.includedConsumed !== null && summary.additionalConsumed !== null ? (
            <>
              <Stat label="Included consumption" value={formatCredits(summary.includedConsumed)} sub="AI Credits" />
              <Stat
                label="Additional consumption"
                value={formatCredits(summary.additionalConsumed)}
                sub="AI Credits"
                tone={redIfPositive(summary.additionalConsumed)}
              />
            </>
          ) : (
            <Stat label="Consumed" value={formatCredits(summary.totalConsumed)} sub="AI Credits" />
          )}

          <div className="col-span-2">
            <Label>Days active</Label>
            <div className="flex items-center gap-3 mt-1">
              {daysPercent !== null && (
                <div className="flex-1 h-1.5 rounded-sm bg-[#e8ecf0] overflow-hidden">
                  <div className="h-full bg-[#2da44e]" style={{ width: `${daysPercent}%` }} />
                </div>
              )}
              <span className="text-sm text-[#1f2328] tabular-nums">
                {summary.daysInPeriod ? `${summary.daysActive} / ${summary.daysInPeriod}` : summary.daysActive}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
