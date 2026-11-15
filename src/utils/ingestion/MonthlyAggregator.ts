import { PRICING } from '@/constants/pricing';

import type { Aggregator, AggregatorContext, MonthlyArtifacts, NormalizedRow } from './types';

interface PartialAggregator<T> extends Aggregator<T> {
  onRow(row: NormalizedRow, ctx: AggregatorContext, sequence?: number): void;
}

/**
 * Only plain artifacts, never accumulator instances or source rows, cross the
 * worker boundary. Compatibility totals are merged once at finalization.
 */
export class MonthlyAggregator<T> implements Aggregator<MonthlyArtifacts<T>> {
  private months = new Map<string, PartialAggregator<T>>();
  private sequence = 0;
  private aggregationFailure?: Error;

  constructor(
    readonly id: string,
    private readonly create: () => PartialAggregator<T>,
    private readonly merge: (partials: T[]) => T,
  ) {}

  init(ctx: AggregatorContext = { pricing: PRICING }): void {
    void ctx;
    this.months.clear();
    this.sequence = 0;
    this.aggregationFailure = undefined;
  }

  onRow(row: NormalizedRow, ctx: AggregatorContext = { pricing: PRICING }): void {
    if (this.aggregationFailure) return;
    const month = row.day.slice(0, 7);
    let partial = this.months.get(month);
    if (!partial) {
      partial = this.create();
      partial.init?.(ctx);
      this.months.set(month, partial);
    }
    try {
      partial.onRow(row, ctx, this.sequence++);
    } catch (error) {
      this.aggregationFailure = error instanceof Error ? error : new Error(String(error));
      throw this.aggregationFailure;
    }
  }

  finalize(ctx: AggregatorContext = { pricing: PRICING }): MonthlyArtifacts<T> {
    if (this.aggregationFailure) throw this.aggregationFailure;
    const byMonth = new Map([...this.months].map(([month, partial]) => [month, partial.finalize(ctx)]));
    return { ...this.merge([...byMonth.values()]), byMonth };
  }
}
