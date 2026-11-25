"use client";

import { useId, useState } from 'react';
import { ResponsiveContainer, Text, Tooltip, Treemap } from 'recharts';
import type { TreemapNode } from 'recharts';

import { bgColor, fgColor } from '@/constants/primerTokens';
import { formatDecimalQuantity } from '@/utils/formatters';
import { getModelColor } from '@/utils/modelColors';

import { chartTooltipContentStyle, chartTooltipItemStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

interface ModelCreditsTreemapDatum {
  fullModel: string;
  credits: number;
}

interface ModelCreditsTreemapProps {
  data: ModelCreditsTreemapDatum[];
}

export function ModelCreditsTreemap({ data }: ModelCreditsTreemapProps) {
  const [focusedModel, setFocusedModel] = useState<string | null>(null);
  const tooltipId = useId();
  const tiles = data
    .filter((item) => item.credits > 0)
    .map((item) => ({ name: item.fullModel, credits: item.credits }))
    .sort((left, right) => right.credits - left.credits);
  const total = tiles.reduce((sum, item) => sum + item.credits, 0);
  const formatShare = (value: number) => `${(value / total * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  const focusedTile = tiles.find((tile) => tile.name === focusedModel);
  const focusedDescription = focusedTile
    ? `${focusedTile.name}: ${formatDecimalQuantity(focusedTile.credits)} AI Credits (${formatShare(focusedTile.credits)})`
    : null;

  return (
    <div className="relative h-72 sm:h-80 2xl:h-96 w-full">
      {tiles.length === 0 ? (
        <div className="flex h-full items-center justify-center rounded-md bg-(--bgColor-muted) text-sm text-(--fgColor-muted)">
          No AI Credits usage for the selected filters.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={tiles}
            dataKey="credits"
            nameKey="name"
            aspectRatio={1}
            isAnimationActive={false}
            content={(node: TreemapNode) => {
              if (node.depth === 0) return <g />;
              const color = getModelColor(node.name);
              const description = `${node.name}: ${formatDecimalQuantity(node.value)} AI Credits (${formatShare(node.value)})`;
              const labelWidth = Math.min(node.width - 16, 180);
              const nameLines = node.height >= 56 ? 2 : 1;
              const showCredits = node.height >= 80;
              const showShare = node.height >= 100;
              const labelHeight = nameLines * 16 + 8 + (showCredits ? 20 : 0) + (showShare ? 20 : 0);
              return (
                <g
                  className="group"
                  tabIndex={0}
                  role="img"
                  aria-label={description}
                  aria-describedby={focusedDescription === description ? tooltipId : undefined}
                  onFocus={() => setFocusedModel(node.name)}
                  onBlur={() => setFocusedModel(null)}
                >
                  <title>{description}</title>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    fill={color}
                    stroke={bgColor.default}
                    strokeWidth={2}
                    className="group-hover:opacity-90 group-focus:stroke-(--fgColor-default)"
                  />
                  {node.width >= 72 && node.height >= 48 && (
                    <svg
                      x={node.x + 8}
                      y={node.y + 8}
                      width={node.width - 16}
                      height={node.height - 16}
                      pointerEvents="none"
                      aria-hidden="true"
                      overflow="hidden"
                    >
                      <rect width={labelWidth} height={labelHeight} rx={2} fill={bgColor.default} />
                      <Text
                        x={4}
                        y={4}
                        width={labelWidth - 8}
                        maxLines={nameLines}
                        verticalAnchor="start"
                        lineHeight={16}
                        fill={fgColor.default}
                        style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--fontStack-sansSerif)' }}
                      >
                        {node.name}
                      </Text>
                      {showCredits && (
                        <Text
                          x={4}
                          y={nameLines * 16 + 8}
                          width={labelWidth - 8}
                          maxLines={1}
                          verticalAnchor="start"
                          fill={fgColor.default}
                          className="tabular-nums"
                          style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'var(--fontStack-sansSerif)' }}
                        >
                          {`${formatDecimalQuantity(node.value)} AI Credits`}
                        </Text>
                      )}
                      {showShare && (
                        <Text
                          x={4}
                          y={nameLines * 16 + 28}
                          width={labelWidth - 8}
                          maxLines={1}
                          verticalAnchor="start"
                          fill={fgColor.default}
                          className="tabular-nums"
                          style={{ fontSize: '12px', fontWeight: 400, fontFamily: 'var(--fontStack-sansSerif)' }}
                        >
                          {formatShare(node.value)}
                        </Text>
                      )}
                    </svg>
                  )}
                </g>
              );
            }}
          >
            <Tooltip
              formatter={(value, name) => [
                `${formatDecimalQuantity(Number(value))} AI Credits (${formatShare(Number(value))})`,
                name,
              ]}
              contentStyle={chartTooltipContentStyle}
              labelStyle={chartTooltipLabelStyle}
              itemStyle={chartTooltipItemStyle}
              wrapperStyle={{ zIndex: 1000 }}
            />
          </Treemap>
        </ResponsiveContainer>
      )}
      {focusedDescription && tiles.length > 0 && (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 rounded-md border border-(--borderColor-default) bg-(--bgColor-default) px-3 py-2 text-xs text-(--fgColor-default)"
        >
          {focusedDescription}
        </div>
      )}
    </div>
  );
}
