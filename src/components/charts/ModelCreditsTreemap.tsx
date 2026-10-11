"use client";

import { useId, useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import type { TreemapNode } from 'recharts';

import { getModelColor } from '@/utils/modelColors';

import { chartTooltipContentStyle, chartTooltipLabelStyle } from './chartTooltipStyles';

interface ModelCreditsTreemapDatum {
  fullModel: string;
  credits: number;
}

interface ModelCreditsTreemapProps {
  data: ModelCreditsTreemapDatum[];
}

function usesDarkText(color: string): boolean {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179;
}

export function ModelCreditsTreemap({ data }: ModelCreditsTreemapProps) {
  const [focusedModel, setFocusedModel] = useState<string | null>(null);
  const tooltipId = useId();
  const tiles = data
    .filter((item) => item.credits > 0)
    .map((item) => ({ name: item.fullModel, credits: item.credits }))
    .sort((left, right) => right.credits - left.credits);
  const total = tiles.reduce((sum, item) => sum + item.credits, 0);
  const formatCredits = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatShare = (value: number) => `${(value / total * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  const focusedTile = tiles.find((tile) => tile.name === focusedModel);
  const focusedDescription = focusedTile
    ? `${focusedTile.name}: ${formatCredits(focusedTile.credits)} AI Credits (${formatShare(focusedTile.credits)})`
    : null;

  return (
    <div className="relative h-72 sm:h-80 2xl:h-96 w-full">
      {tiles.length === 0 ? (
        <div className="flex h-full items-center justify-center rounded-md bg-[#f6f8fa] text-sm text-[#636c76]">
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
              const description = `${node.name}: ${formatCredits(node.value)} AI Credits (${formatShare(node.value)})`;
              return (
                <g
                  className="group outline-none"
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
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="group-hover:opacity-90 group-focus:stroke-[#1f2328]"
                  />
                  {node.width >= 72 && node.height >= 48 && (
                    <foreignObject
                      x={node.x + 8}
                      y={node.y + 8}
                      width={node.width - 16}
                      height={node.height - 16}
                      pointerEvents="none"
                    >
                      <div className={`h-full overflow-hidden text-xs ${usesDarkText(color) ? 'text-[#1f2328]' : 'text-white'}`}>
                        <p className="line-clamp-2 break-words font-semibold">{node.name}</p>
                        {node.height >= 80 && (
                          <p className="mt-1 truncate tabular-nums">
                            {formatCredits(node.value)} AI Credits
                          </p>
                        )}
                        {node.height >= 100 && (
                          <p className="mt-0.5 tabular-nums">{formatShare(node.value)}</p>
                        )}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            }}
          >
            <Tooltip
              formatter={(value, name) => [
                `${formatCredits(Number(value))} AI Credits (${formatShare(Number(value))})`,
                name,
              ]}
              contentStyle={chartTooltipContentStyle}
              labelStyle={chartTooltipLabelStyle}
              wrapperStyle={{ zIndex: 1000 }}
            />
          </Treemap>
        </ResponsiveContainer>
      )}
      {focusedDescription && tiles.length > 0 && (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-xs text-[#1f2328]"
        >
          {focusedDescription}
        </div>
      )}
    </div>
  );
}
