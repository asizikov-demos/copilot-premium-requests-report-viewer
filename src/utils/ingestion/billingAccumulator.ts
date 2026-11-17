import { shouldReplaceQuotaValue } from '@/utils/analytics/quota';
import { isSupportedUsageUnitType } from '@/utils/unitType';

import {
  BillingArtifacts,
  BillingFieldTotals,
  BillingGroupTotals,
  BillingUserTotals,
  getSpecialUsageBucketLabel,
  SpecialBillingBucketTotals,
  SpecialUsageBucketKey,
  UNASSIGNED_BILLING_GROUP,
  type NormalizedRow,
} from './types';

type BillingAccumulatorRow = Pick<
  NormalizedRow,
  | 'user'
  | 'model'
  | 'quantity'
  | 'billingQuantity'
  | 'unitType'
  | 'usageUnit'
  | 'sku'
  | 'quotaValue'
  | 'organization'
  | 'costCenter'
  | 'grossAmount'
  | 'discountAmount'
  | 'netAmount'
  | 'aicQuantity'
  | 'aicGrossAmount'
  | 'isUnattributedUsage'
  | 'usageBucket'
>;

interface AccumulationSignals {
  sawBilling: boolean;
  sawAicGross: boolean;
}

export interface BillingFieldTarget {
  gross?: number;
  discount?: number;
  net?: number;
  aicQuantity?: number;
  aicGrossAmount?: number;
}

type BillingFieldSource = Pick<
  NormalizedRow,
  'grossAmount' | 'discountAmount' | 'netAmount' | 'aicQuantity' | 'aicGrossAmount'
>;

type BillingFieldName = keyof BillingFieldTarget;

function forEachBillingField(
  row: BillingFieldSource,
  includeAicQuantity: boolean,
  add: (field: BillingFieldName, amount: number) => void,
): AccumulationSignals {
  let sawBilling = false;
  let sawAicGross = false;

  if (typeof row.grossAmount === 'number') {
    add('gross', row.grossAmount);
    sawBilling = true;
  }
  if (typeof row.discountAmount === 'number') {
    add('discount', row.discountAmount);
    sawBilling = true;
  }
  if (typeof row.netAmount === 'number') {
    add('net', row.netAmount);
    sawBilling = true;
  }
  if (includeAicQuantity && typeof row.aicQuantity === 'number') {
    add('aicQuantity', row.aicQuantity);
  }
  if (typeof row.aicGrossAmount === 'number') {
    add('aicGrossAmount', row.aicGrossAmount);
    sawAicGross = true;
  }

  return { sawBilling, sawAicGross };
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

export function addBillingFields(
  target: BillingFieldTarget,
  row: BillingFieldSource,
  includeAicQuantity = true,
): AccumulationSignals {
  return forEachBillingField(row, includeAicQuantity, (field, amount) => {
    target[field] = (target[field] ?? 0) + amount;
  });
}

export function addPackedBillingFields(values: number[], offset: number, row: BillingFieldSource): void {
  forEachBillingField(row, false, (field, amount) => {
    const slot = field === 'gross' ? 1
      : field === 'discount' ? 2
        : field === 'net' ? 3
          : 4;
    values[offset + slot] += amount;
  });
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
    const billingRow = {
      ...row,
      quantity: row.billingQuantity ?? row.quantity,
    };
    let entry: BillingUserTotals | SpecialBillingBucketTotals | undefined;
    if (billingRow.isUnattributedUsage && billingRow.usageBucket) {
      entry = this.specialBucketMap.get(billingRow.usageBucket);
      if (!entry) {
        entry = {
          key: billingRow.usageBucket,
          label: getSpecialUsageBucketLabel(billingRow.usageBucket),
          quantity: 0,
          quotaValue: 0,
        };
        this.specialBucketMap.set(billingRow.usageBucket, entry);
      }
    } else {
      entry = this.userMap.get(billingRow.user);
      if (!entry) {
        entry = { user: billingRow.user, quantity: 0 };
        this.userMap.set(billingRow.user, entry);
      }
      const incomingQuota = billingRow.quotaValue ?? 'unknown';
      if (
        isSupportedUsageUnitType(billingRow.unitType, billingRow.sku)
        && shouldReplaceQuotaValue(entry.quotaValue, incomingQuota)
      ) {
        entry.quotaValue = incomingQuota;
      }
    }

    entry.quantity += billingRow.quantity;
    addBillingFields(entry, billingRow);

    addGroupRow(this.orgTotals, billingRow.organization || UNASSIGNED_BILLING_GROUP, billingRow);
    addGroupRow(this.costCenterTotals, billingRow.costCenter || UNASSIGNED_BILLING_GROUP, billingRow);
    addGroupRow(this.billingByModel, billingRow.model, billingRow);

    const signals = addBillingFields(this.totals, billingRow);
    if (signals.sawBilling) this.hasAnyBillingData = true;
    if (signals.sawAicGross) this.hasAnyAicData = true;
  }

  finalize(): BillingArtifacts {
    return {
      totals: { ...this.totals },
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
