/**
 * RawDataAggregator - collects all normalized rows for adapter bridge.
 * This is temporary scaffolding during migration; will be removed once
 * all components consume aggregator outputs directly.
 */

import {
  Aggregator,
  AggregatorContext,
  NormalizedRow
} from './types';

export class RawDataAggregator implements Aggregator<NormalizedRow[]> {
  readonly id = 'rawData';
  
  private rows: NormalizedRow[] = [];
  
  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.rows = [];
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    // Store a copy to avoid reference issues
    this.rows.push({ ...row });
  }
  
  finalize(_ctx: AggregatorContext): NormalizedRow[] {
    void _ctx;
    return this.rows;
  }
}
