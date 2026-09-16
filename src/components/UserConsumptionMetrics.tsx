'use client';

import { useId, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { ProcessedData } from '@/types/csv';
import type { TokenCounts } from '@/types/tokens';
import { buildUserConsumption } from '@/utils/analytics/userConsumption';
import { enumerateDatesInclusive } from '@/utils/dateKeys';

import { chartTooltipContentStyle, chartTooltipLabelStyle, utcDateTickFormatter } from './charts/chartTooltipStyles';
import { TOKEN_COLUMNS, TokenValue } from './TokenValue';

function formatCredits(value: number | undefined): string {
  return value === undefined ? 'N/A' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function UserConsumptionMetrics({ rows, tokensAvailable = true }: {
  rows: ProcessedData[];
  tokensAvailable?: boolean;
}) {
  const [selectedModel, setSelectedModel] = useState('');
  const filterId = useId();
  const metrics = useMemo(() => buildUserConsumption(rows, tokensAvailable), [rows, tokensAvailable]);
  const models = useMemo(() => [...metrics.creditsByModel.keys()].sort(), [metrics]);
  const effectiveModel = models.includes(selectedModel) ? selectedModel : '';
  const hasTokens = metrics.tokens?.hasAnyTokenData === true;
  const hasCredits = metrics.credits.quantity !== undefined;
  const modelRows = useMemo(() => [...metrics.creditsByModel.entries()]
    .sort(([leftName, left], [rightName, right]) =>
      (right.quantity ?? -1) - (left.quantity ?? -1) || leftName.localeCompare(rightName)), [metrics]);
  const trend = useMemo(() => {
    if (!metrics.tokens?.hasAnyTokenData) return [];
    const days = [...metrics.tokens.byDay.keys()];
    if (days.length === 0) return [];
    // Explicit null points prevent lines bridging days without selected report data.
    return enumerateDatesInclusive(days[0], days[days.length - 1])
      .map(date => {
        const day = metrics.tokens?.byDay.get(date);
        const totals = effectiveModel ? day?.byModel.get(effectiveModel) : day?.totals;
        const point: { date: string } & Record<keyof TokenCounts, number | null> = {
          date, inputTokens: null, outputTokens: null, cacheWriteTokens: null, cacheReadTokens: null,
        };
        for (const { field } of TOKEN_COLUMNS) {
          if (totals && totals.reportedRows[field] === totals.rowCount) {
            point[field] = totals[field] ?? null;
          }
        }
        return point;
      });
  }, [metrics, effectiveModel]);

  if (!hasTokens && !hasCredits) return null;

  return (
    <section aria-label="User consumption metrics" className="space-y-6">
      {hasTokens && (
        <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
          <div className="px-5 py-4 border-b border-[#d1d9e0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-[#1f2328]">Token Usage Over Time</h3>
              <p className="text-xs text-[#636c76] mt-1">Daily UTC counts by token type, shown separately. Missing or partial counts leave gaps.</p>
            </div>
            <div className="flex flex-col gap-1 text-xs text-[#636c76]">
              <label htmlFor={filterId}>Trend model</label>
              <select id={filterId} value={effectiveModel} onChange={event => setSelectedModel(event.target.value)}
                className="max-w-full sm:max-w-64 rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] focus:ring-2 focus:ring-indigo-500">
                <option value="">All models</option>
                {models.map(model => <option key={model} value={model}>{model}</option>)}
              </select>
            </div>
          </div>
          <div className="p-5">
            <div className="h-72 sm:h-80 w-full" role="img" aria-label={`Daily token usage for ${effectiveModel || 'all models'}; incomplete values are omitted`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={utcDateTickFormatter} tick={{ fill: '#636c76', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#636c76', fontSize: 11 }} tickFormatter={value => Number(value).toLocaleString(undefined, { notation: 'compact' })} />
                  <Tooltip contentStyle={chartTooltipContentStyle} labelStyle={chartTooltipLabelStyle}
                    labelFormatter={value => `${value} (UTC)`}
                    formatter={(value, name) => [Number(value).toLocaleString(), String(name)]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {TOKEN_COLUMNS.map(({ field, label, color }, index) => (
                    <Line key={field} dataKey={field} name={label} stroke={color} strokeWidth={2}
                      strokeDasharray={index > 1 ? '5 3' : undefined} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!trend.some(day => TOKEN_COLUMNS.some(({ field }) => typeof day[field] === 'number')) && (
              <p className="text-xs text-[#636c76]">No complete daily token counts are available for this selection.</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#d1d9e0] rounded-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d1d9e0]">
          <h3 className="text-sm font-medium text-[#1f2328]">Model Consumption Breakdown</h3>
          <p className="text-xs text-[#636c76] mt-1">
            {hasCredits ? 'Ranked by reported AI Credits. ' : ''}
            Shares compare models within each column, not across token types. Missing counts are —; incomplete totals are marked partial.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full" aria-label="Model Consumption Breakdown">
            <thead><tr className="border-b border-[#d1d9e0]">
              <th scope="col" className="px-5 py-3 text-left text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa]">Model</th>
              {hasCredits && <th scope="col" className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">AI Credits</th>}
              {hasTokens && TOKEN_COLUMNS.map(({ field, label }) => (
                <th key={field} scope="col" className="px-5 py-3 text-right text-[11px] font-semibold text-[#636c76] uppercase tracking-wider bg-[#f6f8fa] whitespace-nowrap">{label}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-[#d1d9e0]">
              {modelRows.map(([model, credits]) => (
                <tr key={model} className="hover:bg-[#fcfdff] transition-colors">
                  <th scope="row" className="px-5 py-3 text-sm font-medium text-[#1f2328] text-left">{model}</th>
                  {hasCredits && (
                    <td className="px-5 py-3 text-sm font-mono tabular-nums text-[#636c76] text-right whitespace-nowrap">
                      {credits.quantity === undefined ? '—' : <>
                        {formatCredits(credits.quantity)}
                        {metrics.credits.quantity !== undefined && metrics.credits.quantity > 0 && <span className="ml-1 text-xs">({(credits.quantity / metrics.credits.quantity * 100).toFixed(1)}%)</span>}
                        {credits.reportedRows < credits.rowCount && <span className="ml-1 text-xs">(partial)</span>}
                      </>}
                    </td>
                  )}
                  {hasTokens && TOKEN_COLUMNS.map(({ field }) => (
                    <td key={field} className="px-5 py-3 text-sm font-mono tabular-nums text-[#636c76] text-right whitespace-nowrap">
                      <TokenValue field={field} totals={metrics.tokens?.byModel.get(model)} overall={metrics.tokens?.totals} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
