/**
 * TokenUsageAggregator
 * ---------------------------------
 * Accumulates source-reported token counts while preserving unavailable fields.
 */

import {
  Aggregator,
  AggregatorContext,
  NormalizedRow,
  TokenBreakdown,
  TokenUsageArtifacts,
} from './types';

type TokenField = keyof TokenBreakdown;

const TOKEN_FIELDS: TokenField[] = [
  'inputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
];

function addTokenValues(target: TokenBreakdown, row: NormalizedRow): boolean {
  let hasTokenValue = false;

  for (const field of TOKEN_FIELDS) {
    const value = row[field];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      target[field] = (target[field] ?? 0) + value;
      hasTokenValue = true;
    }
  }

  return hasTokenValue;
}

export class TokenUsageAggregator implements Aggregator<TokenUsageArtifacts> {
  readonly id = 'tokenUsage';

  private overall: TokenBreakdown = {};
  private byModel = new Map<string, TokenBreakdown>();
  private byUser = new Map<string, TokenBreakdown>();
  private byDayAndModel = new Map<string, Map<string, TokenBreakdown>>();
  private tokenRowCount = 0;

  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.overall = {};
    this.byModel = new Map();
    this.byUser = new Map();
    this.byDayAndModel = new Map();
    this.tokenRowCount = 0;
  }

  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    if (!addTokenValues(this.overall, row)) {
      return;
    }

    this.tokenRowCount++;
    this.addToGroup(this.byModel, row.model, row);
    this.addToGroup(this.byUser, row.user, row);

    let modelsForDay = this.byDayAndModel.get(row.day);
    if (!modelsForDay) {
      modelsForDay = new Map();
      this.byDayAndModel.set(row.day, modelsForDay);
    }
    this.addToGroup(modelsForDay, row.model, row);
  }

  finalize(_ctx: AggregatorContext): TokenUsageArtifacts {
    void _ctx;
    return {
      overall: this.overall,
      byModel: this.byModel,
      byUser: this.byUser,
      byDayAndModel: this.byDayAndModel,
      tokenRowCount: this.tokenRowCount,
      hasTokenData: this.tokenRowCount > 0,
    };
  }

  private addToGroup(
    groups: Map<string, TokenBreakdown>,
    key: string,
    row: NormalizedRow
  ): void {
    const breakdown = groups.get(key) ?? {};
    addTokenValues(breakdown, row);
    groups.set(key, breakdown);
  }
}
