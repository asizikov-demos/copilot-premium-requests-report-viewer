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
import {
  Aggregator,
  AggregatorContext,
  BillingArtifacts,
  BillingUserTotals,
  NON_COPILOT_CODE_REVIEW_LABEL,
  NormalizedRow,
  SpecialBillingBucketTotals,
  SpecialUsageBucketKey
} from './types';

export class BillingAggregator implements Aggregator<BillingArtifacts> {
  readonly id = 'billing';

  private grossTotal = 0;
  private discountTotal = 0;
  private netTotal = 0;
  private userMap = new Map<string, BillingUserTotals>();
  private specialBucketMap = new Map<SpecialUsageBucketKey, SpecialBillingBucketTotals>();
  private hasAnyBillingData = false;

  init(_ctx: AggregatorContext): void {
    void _ctx;
    this.grossTotal = 0;
    this.discountTotal = 0;
    this.netTotal = 0;
    this.userMap.clear();
    this.specialBucketMap.clear();
    this.hasAnyBillingData = false;
  }

  onRow(row: NormalizedRow, _ctx: AggregatorContext): void {
    void _ctx;
    let entry: BillingUserTotals | SpecialBillingBucketTotals | undefined;
    if (row.isNonCopilotUsage && row.usageBucket) {
      entry = this.specialBucketMap.get(row.usageBucket);
      if (!entry) {
        entry = {
          key: row.usageBucket,
          label: NON_COPILOT_CODE_REVIEW_LABEL,
          quantity: 0,
          quotaValue: 0
        };
        this.specialBucketMap.set(row.usageBucket, entry);
      }
    } else {
      entry = this.userMap.get(row.user);
      if (!entry) {
        entry = { user: row.user, quantity: 0 };
        this.userMap.set(row.user, entry);
      }
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
    void _ctx;
    return {
      totals: { gross: this.grossTotal, discount: this.discountTotal, net: this.netTotal },
      users: Array.from(this.userMap.values()),
      userMap: this.userMap,
      hasAnyBillingData: this.hasAnyBillingData,
      specialBuckets: Array.from(this.specialBucketMap.values())
    };
  }
}

export default BillingAggregator;
