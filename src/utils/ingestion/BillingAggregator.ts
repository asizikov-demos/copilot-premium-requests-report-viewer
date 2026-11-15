/**
 * BillingAggregator
 * ---------------------------------
 * Streams normalized rows through the shared BillingAccumulator so the UI can render
 * billing summaries without duplicating billing-field accumulation in components.
 *
 * IMPORTANT:
 *  - We do NOT attempt to recompute costs from quantity * appliedCostPerQuantity.
 *    We merely trust and sum the provided billing columns, preserving the billing
 *    semantics of the exported CSV.
 *  - Undefined values are skipped; aggregation only occurs for numeric values.
 */
import {
  Aggregator,
  AggregatorContext,
  BillingArtifacts,
  NormalizedRow,
} from './types';
import { BillingAccumulator } from './billingAccumulator';
import { MonthlyAggregator } from './MonthlyAggregator';
import { mergeBillingArtifacts } from './selectors';

class BillingPartialAggregator implements Aggregator<BillingArtifacts> {
  readonly id = 'billing';

  private accumulator = new BillingAccumulator();

  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.accumulator = new BillingAccumulator();
  }

  onRow(row: NormalizedRow, _ctx: AggregatorContext, sequence?: number): void {
    void _ctx;
    this.accumulator.addRow(row, sequence);
  }

  finalize(_ctx: AggregatorContext): BillingArtifacts {
    void _ctx;
    return this.accumulator.finalize();
  }
}

export class BillingAggregator extends MonthlyAggregator<BillingArtifacts> {
  constructor() {
    super('billing', () => new BillingPartialAggregator(), mergeBillingArtifacts);
  }
}

export default BillingAggregator;
