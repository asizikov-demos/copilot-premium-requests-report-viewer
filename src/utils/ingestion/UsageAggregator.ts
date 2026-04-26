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

export class UsageAggregator implements Aggregator<UsageArtifacts> {
  readonly id = 'usage';

  private accumulator = new UsageAccumulator();
  
  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.accumulator = new UsageAccumulator();
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    this.accumulator.addRow(row);
  }
  
  finalize(_ctx: AggregatorContext): UsageArtifacts {
    void _ctx;
    return this.accumulator.finalize();
  }
}
