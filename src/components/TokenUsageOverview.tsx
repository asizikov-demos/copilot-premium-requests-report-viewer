'use client';

import React, { useMemo, useState } from 'react';

import { TokenUsageByDayChart, type TokenUsageByDayChartDatum } from '@/components/charts/TokenUsageByDayChart';
import { TOKEN_TYPE_SERIES } from '@/components/charts/tokenUsageChartSeries';
import type { TokenBreakdown, TokenUsageArtifacts } from '@/utils/ingestion';

interface TokenUsageOverviewProps {
  tokenUsageArtifacts?: TokenUsageArtifacts;
}

interface TokenModelRow {
  model: string;
  tokens: TokenBreakdown;
  tokenTotal: number;
}

function formatTokenValue(value: number | undefined): string {
  return value === undefined ? 'N/A' : value.toLocaleString();
}

function compareTokenModelRows(left: TokenModelRow, right: TokenModelRow): number {
  if (right.tokenTotal !== left.tokenTotal) {
    return right.tokenTotal - left.tokenTotal;
  }

  return left.model.localeCompare(right.model);
}

function aggregateTokenBreakdowns(breakdowns: Iterable<TokenBreakdown>): TokenBreakdown {
  const result: TokenBreakdown = {};

  for (const breakdown of breakdowns) {
    for (const series of TOKEN_TYPE_SERIES) {
      const value = breakdown[series.key];
      if (value !== undefined) {
        result[series.key] = (result[series.key] ?? 0) + value;
      }
    }
  }

  return result;
}

function getTokenTotal(tokens: TokenBreakdown): number {
  return TOKEN_TYPE_SERIES.reduce((total, series) => total + (tokens[series.key] ?? 0), 0);
}

function formatTokenShare(value: number | undefined, total: number): string | undefined {
  if (value === undefined || total === 0) {
    return undefined;
  }

  return `${((value / total) * 100).toFixed(1)}\u00a0%`;
}

export function TokenUsageOverview({ tokenUsageArtifacts }: TokenUsageOverviewProps) {
  const [selectedModel, setSelectedModel] = useState('all');
  const modelRows = useMemo(() => {
    if (!tokenUsageArtifacts) {
      return [];
    }

    return Array.from(tokenUsageArtifacts.byModel.entries())
      .map(([model, tokens]) => ({
        model,
        tokens,
        tokenTotal: getTokenTotal(tokens),
      }))
      .sort(compareTokenModelRows);
  }, [tokenUsageArtifacts]);

  const dailyChartData = useMemo((): TokenUsageByDayChartDatum[] => {
    if (!tokenUsageArtifacts) {
      return [];
    }

    return Array.from(tokenUsageArtifacts.byDayAndModel.entries())
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([date, byModel]) => ({
        date,
        ...(selectedModel === 'all'
          ? aggregateTokenBreakdowns(byModel.values())
          : byModel.get(selectedModel) ?? {}),
      }));
  }, [selectedModel, tokenUsageArtifacts]);

  if (!tokenUsageArtifacts?.hasTokenData) {
    return (
      <div className="p-4 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
        <p className="text-sm text-[#636c76]">Token details are not included in this report.</p>
      </div>
    );
  }

  const overallTokenTotal = getTokenTotal(tokenUsageArtifacts.overall);

  return (
    <section aria-label="Token details" className="space-y-5">
      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h4 className="text-sm font-medium text-[#1f2328]">Token summary</h4>
          <p className="text-xs text-[#636c76] mt-0.5">Token volume is shown by field and total.</p>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 p-5">
          <div className="p-4 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
            <dt className="text-xs font-medium text-[#636c76] uppercase tracking-[0.05em]">Total tokens</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#1f2328]">
              {overallTokenTotal.toLocaleString()}
            </dd>
          </div>
          {TOKEN_TYPE_SERIES.map((series) => {
            const tokenShare = formatTokenShare(tokenUsageArtifacts.overall[series.key], overallTokenTotal);

            return (
              <div key={series.key} className="p-4 bg-[#f6f8fa] border border-[#d1d9e0] rounded-md">
                <dt className="text-xs font-medium text-[#636c76] uppercase tracking-[0.05em]">{series.label}</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tabular-nums text-[#1f2328]">
                    {formatTokenValue(tokenUsageArtifacts.overall[series.key])}
                  </span>
                  {tokenShare !== undefined && (
                    <span className="text-xs font-mono tabular-nums text-[#636c76]">
                      ({tokenShare})
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h4 className="text-sm font-medium text-[#1f2328]">Per-model token breakdown</h4>
          <p className="text-xs text-[#636c76] mt-0.5">Models are ordered by total tokens.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[56rem] w-full" aria-label="Per-model token breakdown">
            <thead>
              <tr className="border-b border-[#d1d9e0]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Model</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">Total tokens</th>
                {TOKEN_TYPE_SERIES.map((series) => (
                  <th key={series.key} className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">
                    <span className="block">{series.label}</span>
                    <span className="block mt-0.5 text-[10px] font-medium normal-case tracking-normal text-[#636c76]">
                      Count; share in brackets
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d1d9e0]">
              {modelRows.map((row) => (
                <tr key={row.model} className="hover:bg-[#fcfdff] transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-[#1f2328] whitespace-nowrap">{row.model}</td>
                  <td className="px-5 py-3 text-sm font-mono font-semibold tabular-nums text-[#1f2328] text-right bg-[#f6f8fa] whitespace-nowrap">
                    {row.tokenTotal.toLocaleString()}
                  </td>
                  {TOKEN_TYPE_SERIES.map((series) => {
                    const tokenShare = formatTokenShare(row.tokens[series.key], row.tokenTotal);

                    return (
                      <td key={series.key} className="px-5 py-3 text-right whitespace-nowrap">
                        {tokenShare !== undefined ? (
                          <div className="flex items-baseline justify-end gap-1.5">
                            <span className="text-sm font-mono font-semibold tabular-nums text-[#1f2328]">
                              {formatTokenValue(row.tokens[series.key])}
                            </span>
                            <span className="text-xs font-mono tabular-nums text-[#636c76]">
                              ({tokenShare})
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-mono font-semibold tabular-nums text-[#1f2328]">
                            {formatTokenValue(row.tokens[series.key])}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white border border-[#d1d9e0] rounded-md p-5 min-h-[20rem]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-medium text-[#1f2328]">Daily source token usage</h4>
            <p className="text-xs text-[#636c76] mt-0.5">UTC source-report fields by day.</p>
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-[#636c76]">
            <label htmlFor="token-model-selector" className="font-medium text-[#1f2328]">Model</label>
            <select
              id="token-model-selector"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="min-w-56 rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] shadow-sm outline-none transition duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All models</option>
              {modelRows.map((row) => (
                <option key={row.model} value={row.model}>{row.model}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 h-72 sm:h-96 2xl:h-[28rem] w-full">
          <TokenUsageByDayChart data={dailyChartData} />
        </div>
      </div>
    </section>
  );
}
