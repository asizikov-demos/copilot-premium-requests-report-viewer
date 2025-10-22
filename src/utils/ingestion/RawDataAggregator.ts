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
    this.rows = [];
  }
  
  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    // Store a copy to avoid reference issues
    this.rows.push({ ...row });
  }
  
  finalize(_ctx: AggregatorContext): NormalizedRow[] {
    return this.rows;
  }
}
