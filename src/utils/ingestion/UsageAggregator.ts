/**
 * UsageAggregator - computes per-user and per-model usage totals.
 * Replaces repeated O(R) scans with incremental O(1) updates.
 */

import {
  Aggregator,
  AggregatorContext,
  NormalizedRow,
  UsageArtifacts,
} from './types';
import { UsageAccumulator } from './UsageAccumulator';
import { MonthlyAggregator } from './MonthlyAggregator';
import { mergeUsageArtifacts } from './selectors';

class UsagePartialAggregator implements Aggregator<UsageArtifacts> {
  readonly id = 'usage';

  private accumulator = new UsageAccumulator();
  
  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.accumulator = new UsageAccumulator();
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext, sequence?: number): void {
    void _ctx;
    this.accumulator.addRow(row, sequence);
  }

  finalize(_ctx: AggregatorContext): UsageArtifacts {
    void _ctx;
    return this.accumulator.finalize();
  }
}

export class UsageAggregator extends MonthlyAggregator<UsageArtifacts> {
  constructor() {
    super('usage', () => new UsagePartialAggregator(), mergeUsageArtifacts);
  }
}
