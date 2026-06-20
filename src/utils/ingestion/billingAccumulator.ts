import type { ProcessedData } from '@/types/csv';
import { shouldReplaceQuotaValue } from '@/utils/analytics/quota';
import { calculateAicPoolEstimate, calculateIncludedAicCreditsForUsers } from '@/utils/aicPool';
import { isSupportedUsageUnitType, type UsageUnitKind } from '@/utils/unitType';

import {
  BillingArtifacts,
  BillingFieldTotals,
  BillingGroupTotals,
  BillingOverageTotals,
  BillingUserTotals,
  NON_COPILOT_CODE_REVIEW_LABEL,
  SpecialBillingBucketTotals,
  SpecialUsageBucketKey,
  UNASSIGNED_BILLING_GROUP,
} from './types';

interface BillingAccumulatorRow {
  user: string;
  model: string;
  quantity: number;
  billingQuantity?: number;
  unitType?: string;
  usageUnit?: UsageUnitKind;
  sku?: string;
  quotaValue?: number | 'unknown';
  organization?: string;
  costCenter?: string;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  exceedsQuota?: boolean;
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

function createBillingOverageTotals(): BillingOverageTotals {
  return {
    requests: 0,
    cost: 0,
    hasBilledOverageData: false,
  };
}

type BillingFieldTarget = BillingFieldTotals | BillingUserTotals | SpecialBillingBucketTotals;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasBillingAmountData(row: BillingAccumulatorRow): boolean {
  return isFiniteNumber(row.netAmount) || isFiniteNumber(row.grossAmount);
}

function getBilledOverageCost(row: BillingAccumulatorRow): number {
  if (isFiniteNumber(row.netAmount)) {
    return row.netAmount;
  }

  if (isFiniteNumber(row.grossAmount)) {
    return row.grossAmount - (isFiniteNumber(row.discountAmount) ? row.discountAmount : 0);
  }

  return 0;
}

function addBilledOverage(target: BillingOverageTotals, row: BillingAccumulatorRow): void {
  if (!row.exceedsQuota) {
    return;
  }

  target.requests += row.quantity;

  if (hasBillingAmountData(row)) {
    target.hasBilledOverageData = true;
    target.cost += getBilledOverageCost(row);
  }
}

function addBillingFields(target: BillingFieldTarget, row: BillingAccumulatorRow): AccumulationSignals {
  let sawBilling = false;
  let sawAicGross = false;

  if (typeof row.grossAmount === 'number') {
    target.gross = (target.gross || 0) + row.grossAmount;
    sawBilling = true;
  }
  if (typeof row.discountAmount === 'number') {
    target.discount = (target.discount || 0) + row.discountAmount;
    sawBilling = true;
  }
  if (typeof row.netAmount === 'number') {
    target.net = (target.net || 0) + row.netAmount;
    sawBilling = true;
  }
  if (typeof row.aicQuantity === 'number') {
    target.aicQuantity = (target.aicQuantity || 0) + row.aicQuantity;
  }
  if (typeof row.aicGrossAmount === 'number') {
    target.aicGrossAmount = (target.aicGrossAmount || 0) + row.aicGrossAmount;
    sawAicGross = true;
  }

  return { sawBilling, sawAicGross };
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
  private overage = createBillingOverageTotals();
  private hasAnyBillingData = false;
  private hasAnyAicData = false;

  addRow(row: BillingAccumulatorRow): void {
    const billingRow = {
      ...row,
      quantity: row.billingQuantity ?? row.quantity,
    };
    let entry: BillingUserTotals | SpecialBillingBucketTotals | undefined;
    if (billingRow.isNonCopilotUsage && billingRow.usageBucket) {
      entry = this.specialBucketMap.get(billingRow.usageBucket);
      if (!entry) {
        entry = {
          key: billingRow.usageBucket,
          label: NON_COPILOT_CODE_REVIEW_LABEL,
          quantity: 0,
          overage: createBillingOverageTotals(),
          quotaValue: 0,
        };
        this.specialBucketMap.set(billingRow.usageBucket, entry);
      }
    } else {
      entry = this.userMap.get(billingRow.user);
      if (!entry) {
        entry = { user: billingRow.user, quantity: 0, overage: createBillingOverageTotals() };
        this.userMap.set(billingRow.user, entry);
      }
      const incomingQuota = billingRow.quotaValue;
      if (
        isSupportedUsageUnitType(billingRow.unitType, billingRow.sku)
        && incomingQuota !== undefined
        && shouldReplaceQuotaValue(entry.quotaValue, incomingQuota)
      ) {
        entry.quotaValue = incomingQuota;
      }
    }

    entry.quantity += billingRow.quantity;
    addBilledOverage(entry.overage, row);
    addBilledOverage(this.overage, row);
    addBillingFields(entry, billingRow);

    addGroupRow(this.orgTotals, billingRow.organization || UNASSIGNED_BILLING_GROUP, billingRow);
    addGroupRow(this.costCenterTotals, billingRow.costCenter || UNASSIGNED_BILLING_GROUP, billingRow);
    addGroupRow(this.billingByModel, billingRow.model, billingRow);

    const signals = addBillingFields(this.totals, billingRow);
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
      overage: this.overage,
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
      billingQuantity: row.billingQuantity,
      quotaValue: isSupportedUsageUnitType(row.unitType, row.sku) ? row.quotaValue : undefined,
    });
  }

  return accumulator.finalize();
}
