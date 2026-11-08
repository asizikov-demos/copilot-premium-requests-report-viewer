'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, GraphIcon } from '@primer/octicons-react';
import { Button } from '@primer/react';
import { Blankslate } from '@primer/react/experimental';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { bgColor } from '@/constants/primerTokens';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import { formatCurrency, formatDecimalQuantity } from '@/utils/formatters';
import { getModelColor } from '@/utils/modelColors';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

interface ModelBucketDistributionChartsProps {
  rows: Pick<ProcessedData, 'model' | 'creditsUsed' | 'aicGrossAmount' | 'user' | 'isUnattributedUsage'>[];
}

const BUCKETS = [
  { label: 'Auto', prefix: 'Auto:' },
  { label: 'Fusion (Standard)', prefix: 'Fusion (Standard):' },
  { label: 'Fusion (High)', prefix: 'Fusion (High):' },
  { label: 'Fusion (Max)', prefix: 'Fusion (Max):' },
];
const MODEL_PREVIEW_COUNT = 5;

export function ModelBucketDistributionCharts({ rows }: ModelBucketDistributionChartsProps) {
  const listId = useId();
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const distributions = useMemo(() => {
    const creditsByBucket = BUCKETS.map(() => new Map<string, { credits: number; grossAmount: number }>());
    const usersByBucket = BUCKETS.map(() => new Set<string>());
    for (const row of rows) {
      const bucketIndex = BUCKETS.findIndex(({ prefix }) => row.model.toLowerCase().startsWith(prefix.toLowerCase()));
      if (bucketIndex === -1) continue;

      if (row.user.trim() && !row.isUnattributedUsage) {
        usersByBucket[bucketIndex].add(row.user);
      }

      const model = row.model.slice(BUCKETS[bucketIndex].prefix.length).trim();
      const creditsByModel = creditsByBucket[bucketIndex];
      const previous = creditsByModel.get(model);
      creditsByModel.set(model, {
        credits: (previous?.credits ?? 0) + row.creditsUsed,
        grossAmount: (previous?.grossAmount ?? 0) + (row.aicGrossAmount ?? row.creditsUsed * PRICING.AI_CREDIT_USD_VALUE),
      });
    }

    return BUCKETS.map((bucket, index) => {
      const models = [...creditsByBucket[index]]
        .filter(([, { credits }]) => credits > 0)
        .map(([model, amounts]) => ({ model, ...amounts, fill: getModelColor(model) }))
        .sort((left, right) => right.credits - left.credits || left.model.localeCompare(right.model));
      return {
        ...bucket,
        models,
        total: models.reduce((sum, model) => sum + model.credits, 0),
        uniqueUsers: usersByBucket[index].size,
      };
    });
  }, [rows]);

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {distributions.map(({ label, models, total, uniqueUsers }, index) => (
        <section
          key={label}
          aria-label={`${label} model distribution`}
          className="flex h-[28rem] min-w-0 flex-col overflow-hidden rounded-md border border-(--borderColor-default) bg-(--bgColor-default)"
        >
          <div className="shrink-0 border-b border-(--borderColor-default) px-4 py-3">
            <h3 className="text-sm font-medium text-(--fgColor-default)">{label} model distribution</h3>
            <p className="mt-1 text-xs tabular-nums text-(--fgColor-muted)">
              {uniqueUsers.toLocaleString()} unique {uniqueUsers === 1 ? 'user' : 'users'}
            </p>
          </div>
          {models.length === 0 ? (
            <div className="grid min-h-0 flex-1 items-center p-4">
              <Blankslate size="small">
                <Blankslate.Visual>
                  <GraphIcon size={24} />
                </Blankslate.Visual>
                <Blankslate.Heading as="h4">No model usage</Blankslate.Heading>
                <Blankslate.Description>
                  No {label} usage was reported for the selected billing period.
                </Blankslate.Description>
              </Blankslate>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="relative h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart aria-label={`${label} model AI Credits distribution`}>
                    <Pie
                      data={models}
                      dataKey="credits"
                      nameKey="model"
                      innerRadius="65%"
                      outerRadius="90%"
                      stroke={bgColor.default}
                      isAnimationActive={false}
                    />
                    <Tooltip
                      wrapperStyle={{ zIndex: 20 }}
                      content={({ active, payload }) => {
                        const model = models.find((entry) => entry.model === payload?.[0]?.name);
                        if (!active || !model) return null;

                        return (
                          <div role="status" style={chartTooltipContentStyle}>
                            <p style={chartTooltipLabelStyle}>{model.model}</p>
                            <p className="whitespace-nowrap tabular-nums">
                              {formatCurrency(model.grossAmount)} gross cost (USD)
                            </p>
                            <p className="mt-1 text-(--fgColor-muted)">
                              {((model.credits / total) * 100).toFixed(1)}% of AI Credits
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-semibold tabular-nums text-(--fgColor-default)">
                    {formatDecimalQuantity(total)}
                  </span>
                  <span className="text-xs text-(--fgColor-muted)">AI Credits</span>
                </div>
              </div>
              <ul
                id={`${listId}-${index}`}
                className={`min-h-0 flex-1 space-y-1.5 ${expandedBuckets.has(label) ? 'overflow-y-auto' : ''}`}
                aria-label={`${label} model gross cost (USD) and AI Credits share`}
                tabIndex={expandedBuckets.has(label) ? 0 : undefined}
              >
                {(expandedBuckets.has(label) ? models : models.slice(0, MODEL_PREVIEW_COUNT)).map(({ model, credits, grossAmount, fill }) => (
                  <li key={model} className="grid grid-cols-[minmax(0,1fr)_max-content_3rem] items-center gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-(--fgColor-default)">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: fill }} aria-hidden="true" />
                      <span className="truncate" title={model}>{model}</span>
                    </span>
                    <span className="whitespace-nowrap text-right font-mono tabular-nums text-(--fgColor-default)">
                      {formatCurrency(grossAmount)}
                    </span>
                    <span className="whitespace-nowrap text-right tabular-nums text-(--fgColor-muted)">
                      {((credits / total) * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 h-8 shrink-0">
                {models.length > MODEL_PREVIEW_COUNT && (
                  <Button
                    variant="invisible"
                    size="small"
                    leadingVisual={expandedBuckets.has(label) ? ChevronUpIcon : ChevronDownIcon}
                    aria-expanded={expandedBuckets.has(label)}
                    aria-controls={`${listId}-${index}`}
                    onClick={() => setExpandedBuckets((previous) => {
                      const next = new Set(previous);
                      if (next.has(label)) next.delete(label);
                      else next.add(label);
                      return next;
                    })}
                  >
                    {expandedBuckets.has(label) ? 'Show fewer models' : `Show all ${models.length} models`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
