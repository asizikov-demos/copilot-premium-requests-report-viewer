'use client';

import React from 'react';
import { CopyIcon } from '@primer/octicons-react';

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
  value !== null && value > 0 ? 'text-(--fgColor-danger)' : 'text-(--fgColor-default)';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-(--fgColor-muted) uppercase tracking-[0.05em]">{children}</p>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'text-(--fgColor-default)',
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
      {sub && <p className="text-xs text-(--fgColor-muted)">{sub}</p>}
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
    <div className="bg-(--bgColor-default) border border-(--borderColor-default) rounded-md p-5">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <button
              type="button"
              onClick={onBack}
              className="text-2xl font-semibold tracking-tight text-(--fgColor-accent) hover:underline rounded-sm"
            >
              users
            </button>
          </li>
          <li aria-hidden="true" className="text-2xl font-semibold tracking-tight text-(--fgColor-muted)">/</li>
          <li>
            <button
              type="button"
              onClick={onCopyUser}
              title="Click to copy username"
              className="text-2xl font-semibold tracking-tight text-(--fgColor-default) hover:text-(--fgColor-accent) transition-colors duration-150 rounded-sm inline-flex items-center gap-2 group"
            >
              {user}
              <CopyIcon
                size={16}
                className="text-(--fgColor-muted) group-hover:text-(--fgColor-accent) transition-colors duration-150"
              />
            </button>
          </li>
        </ol>
      </nav>

      <div className="grid md:grid-cols-[280px_1fr] gap-x-10 gap-y-6 mt-4">
        <dl className="space-y-2 md:border-r md:border-(--borderColor-default) md:pr-6">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs text-(--fgColor-muted)">{detail.label}</dt>
              <dd className="text-sm text-(--fgColor-default) break-words">{detail.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 content-start">
          <div className="col-span-2">
            <Label>Total consumption</Label>
            {summary.totalCost !== null ? (
              <>
                <p className="display-heading text-4xl font-semibold text-(--fgColor-default) tabular-nums">
                  {formatCurrency(summary.totalCost)}
                </p>
                <p className="text-xs text-(--fgColor-muted)">
                  of which additional consumption:{' '}
                  <b className={redIfPositive(summary.additionalCost)}>
                    {formatCurrency(summary.additionalCost ?? 0)}
                  </b>
                </p>
              </>
            ) : (
              <p className="text-sm text-(--fgColor-muted) mt-1">Not available in this export</p>
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
                <div className="flex-1 h-1.5 rounded-sm bg-(--progressBar-track-bgColor) overflow-hidden">
                  <div className="h-full bg-(--progressBar-bgColor-success)" style={{ width: `${daysPercent}%` }} />
                </div>
              )}
              <span className="text-sm text-(--fgColor-default) tabular-nums">
                {summary.daysInPeriod ? `${summary.daysActive} / ${summary.daysInPeriod}` : summary.daysActive}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
