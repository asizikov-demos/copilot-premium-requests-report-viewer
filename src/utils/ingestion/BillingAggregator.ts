/**
 * BillingAggregator
 * ---------------------------------
 * Streams normalized rows and accumulates billing-related numeric fields:
 *  - grossAmount
 *  - discountAmount
 *  - netAmount
 * Also tracks per-user billing totals (including total request quantity for convenience)
 * so the UI can render billing summaries without scanning raw rows or ProcessedData.
 *
 * IMPORTANT:
 *  - We do NOT attempt to recompute costs from quantity * appliedCostPerQuantity.
 *    We merely trust and sum the provided billing columns, preserving the billing
 *    semantics of the exported CSV.
 *  - Undefined values are skipped; aggregation only occurs for numeric values.
 */
import { Aggregator, AggregatorContext, NormalizedRow, BillingArtifacts, BillingUserTotals } from './types';

export class BillingAggregator implements Aggregator<BillingArtifacts> {
  readonly id = 'billing';

  private grossTotal = 0;
  private discountTotal = 0;
  private netTotal = 0;
  private userMap = new Map<string, BillingUserTotals>();
  private hasAnyBillingData = false;

  init(_ctx: AggregatorContext): void {
    this.grossTotal = 0;
    this.discountTotal = 0;
    this.netTotal = 0;
    this.userMap.clear();
    this.hasAnyBillingData = false;
  }

  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    // Fast path: if no billing columns present in this row and none seen yet, still need to track quantity per user if billing appears later.
    let entry = this.userMap.get(row.user);
    if (!entry) {
      entry = { user: row.user, quantity: 0 };
      this.userMap.set(row.user, entry);
    }
    entry.quantity += row.quantity;

    let sawBilling = false;
    if (typeof row.grossAmount === 'number') {
      this.grossTotal += row.grossAmount;
      entry.gross = (entry.gross || 0) + row.grossAmount;
      sawBilling = true;
    }
    if (typeof row.discountAmount === 'number') {
      this.discountTotal += row.discountAmount;
      entry.discount = (entry.discount || 0) + row.discountAmount;
      sawBilling = true;
    }
    if (typeof row.netAmount === 'number') {
      this.netTotal += row.netAmount;
      entry.net = (entry.net || 0) + row.netAmount;
      sawBilling = true;
    }
    if (sawBilling) this.hasAnyBillingData = true;
  }

  finalize(_ctx: AggregatorContext): BillingArtifacts {
    return {
      totals: { gross: this.grossTotal, discount: this.discountTotal, net: this.netTotal },
      users: Array.from(this.userMap.values()),
      userMap: this.userMap,
      hasAnyBillingData: this.hasAnyBillingData
    };
  }
}

export default BillingAggregator;