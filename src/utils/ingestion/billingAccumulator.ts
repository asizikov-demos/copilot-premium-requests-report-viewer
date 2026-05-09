import type { ProcessedData } from '@/types/csv';
import { calculateAicPoolEstimate, calculateIncludedAicCreditsForUsers } from '@/utils/aicPool';

import {
  BillingArtifacts,
  BillingFieldTotals,
  BillingGroupTotals,
  BillingUserTotals,
  NON_COPILOT_CODE_REVIEW_LABEL,
  SpecialBillingBucketTotals,
  SpecialUsageBucketKey,
} from './types';

interface BillingAccumulatorRow {
  user: string;
  model: string;
  quantity: number;
  quotaValue?: number | 'unlimited';
  organization?: string;
  costCenter?: string;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  aicQuantity?: number;
  aicGrossAmount?: number;
  isNonCopilotUsage?: boolean;
  usageBucket?: SpecialUsageBucketKey;
}

interface AccumulationSignals {
  sawBilling: boolean;
  sawAicGross: boolean;
}

function createBillingFieldTotals(): BillingFieldTotals {
  return {
    gross: 0,
    discount: 0,
    net: 0,
    aicQuantity: 0,
    aicGrossAmount: 0,
  };
}

function createBillingGroupTotals(): BillingGroupTotals {
  return {
    ...createBillingFieldTotals(),
    quantity: 0,
  };
}

function addBillingFields(target: BillingFieldTotals, row: BillingAccumulatorRow): AccumulationSignals {
  let sawBilling = false;
  let sawAicGross = false;

  if (typeof row.grossAmount === 'number') {
    target.gross += row.grossAmount;
    sawBilling = true;
  }
  if (typeof row.discountAmount === 'number') {
    target.discount += row.discountAmount;
    sawBilling = true;
  }
  if (typeof row.netAmount === 'number') {
    target.net += row.netAmount;
    sawBilling = true;
  }
  if (typeof row.aicQuantity === 'number') {
    target.aicQuantity += row.aicQuantity;
  }
  if (typeof row.aicGrossAmount === 'number') {
    target.aicGrossAmount += row.aicGrossAmount;
    sawAicGross = true;
  }

  return { sawBilling, sawAicGross };
}

function addOptionalBillingFields(target: BillingUserTotals | SpecialBillingBucketTotals, row: BillingAccumulatorRow): void {
  if (typeof row.grossAmount === 'number') {
    target.gross = (target.gross || 0) + row.grossAmount;
  }
  if (typeof row.discountAmount === 'number') {
    target.discount = (target.discount || 0) + row.discountAmount;
  }
  if (typeof row.netAmount === 'number') {
    target.net = (target.net || 0) + row.netAmount;
  }
  if (typeof row.aicQuantity === 'number') {
    target.aicQuantity = (target.aicQuantity || 0) + row.aicQuantity;
  }
  if (typeof row.aicGrossAmount === 'number') {
    target.aicGrossAmount = (target.aicGrossAmount || 0) + row.aicGrossAmount;
  }
}

function addGroupRow(groups: Map<string, BillingGroupTotals>, key: string, row: BillingAccumulatorRow): void {
  const entry = groups.get(key) ?? createBillingGroupTotals();
  entry.quantity += row.quantity;
  addBillingFields(entry, row);
  groups.set(key, entry);
}

export class BillingAccumulator {
  private totals = createBillingFieldTotals();
  private userMap = new Map<string, BillingUserTotals>();
  private specialBucketMap = new Map<SpecialUsageBucketKey, SpecialBillingBucketTotals>();
  private orgTotals = new Map<string, BillingGroupTotals>();
  private costCenterTotals = new Map<string, BillingGroupTotals>();
  private billingByModel = new Map<string, BillingGroupTotals>();
  private hasAnyBillingData = false;
  private hasAnyAicData = false;

  addRow(row: BillingAccumulatorRow): void {
    let entry: BillingUserTotals | SpecialBillingBucketTotals | undefined;
    if (row.isNonCopilotUsage && row.usageBucket) {
      entry = this.specialBucketMap.get(row.usageBucket);
      if (!entry) {
        entry = {
          key: row.usageBucket,
          label: NON_COPILOT_CODE_REVIEW_LABEL,
          quantity: 0,
          quotaValue: 0,
        };
        this.specialBucketMap.set(row.usageBucket, entry);
      }
    } else {
      entry = this.userMap.get(row.user);
      if (!entry) {
        entry = { user: row.user, quantity: 0 };
        this.userMap.set(row.user, entry);
      }
      if (entry.quotaValue === undefined && row.quotaValue !== undefined) {
        entry.quotaValue = row.quotaValue;
      }
    }

    entry.quantity += row.quantity;
    addOptionalBillingFields(entry, row);

    addGroupRow(this.orgTotals, row.organization || 'Unassigned', row);
    addGroupRow(this.costCenterTotals, row.costCenter || 'Unassigned', row);
    addGroupRow(this.billingByModel, row.model, row);

    const signals = addBillingFields(this.totals, row);
    if (signals.sawBilling) this.hasAnyBillingData = true;
    if (signals.sawAicGross) this.hasAnyAicData = true;
  }

  finalize(): BillingArtifacts {
    const poolEstimate = this.hasAnyAicData
      ? calculateAicPoolEstimate(
        calculateIncludedAicCreditsForUsers(this.userMap.values()),
        this.totals.aicGrossAmount
      )
      : { includedCredits: 0, additionalUsageGrossAmount: 0 };

    return {
      totals: {
        ...this.totals,
        aicIncludedCredits: poolEstimate.includedCredits,
        aicAdditionalUsageGrossAmount: poolEstimate.additionalUsageGrossAmount,
      },
      users: Array.from(this.userMap.values()),
      userMap: this.userMap,
      orgTotals: this.orgTotals,
      costCenterTotals: this.costCenterTotals,
      billingByModel: this.billingByModel,
      hasAnyBillingData: this.hasAnyBillingData,
      hasAnyAicData: this.hasAnyAicData,
      specialBuckets: Array.from(this.specialBucketMap.values()),
    };
  }
}

export function buildBillingArtifactsFromProcessedData(rows: ProcessedData[]): BillingArtifacts {
  const accumulator = new BillingAccumulator();

  for (const row of rows) {
    accumulator.addRow({
      ...row,
      quantity: row.requestsUsed,
    });
  }

  return accumulator.finalize();
}
