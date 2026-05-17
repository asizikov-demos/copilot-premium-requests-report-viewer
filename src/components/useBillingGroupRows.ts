import { useMemo } from 'react';

import type { ProcessedData } from '@/types/csv';
import type { BillingGroupTotals } from '@/utils/ingestion/types';
import {
  accumulateProductCost,
  createEmptyProductCostMap,
  getPopulatedProductCosts,
} from '@/utils/productCosts';

import type { BillingGroupRow } from './BillingGroupTable';

interface UseBillingGroupRowsOptions<TExtraState, TExtraFields extends object> {
  rows: ProcessedData[];
  totalsByGroup?: Map<string, BillingGroupTotals>;
  getGroupName: (row: ProcessedData) => string;
  createExtraState: () => TExtraState;
  updateExtraState: (state: TExtraState, row: ProcessedData) => void;
  getExtraFields: (state: TExtraState) => TExtraFields;
}

export function useBillingGroupRows<TExtraState, TExtraFields extends object = Record<string, never>>({
  rows,
  totalsByGroup,
  getGroupName,
  createExtraState,
  updateExtraState,
  getExtraFields,
}: UseBillingGroupRowsOptions<TExtraState, TExtraFields>): Array<BillingGroupRow & TExtraFields> {
  return useMemo(() => {
    const map = new Map<string, {
      requests: number;
      productBuckets: ReturnType<typeof createEmptyProductCostMap>;
      extraState: TExtraState;
    }>();

    for (const row of rows) {
      const groupName = getGroupName(row);
      let entry = map.get(groupName);
      if (!entry) {
        entry = {
          requests: 0,
          productBuckets: createEmptyProductCostMap(),
          extraState: createExtraState(),
        };
        map.set(groupName, entry);
      }

      entry.requests += row.requestsUsed;
      accumulateProductCost(entry.productBuckets, row);
      updateExtraState(entry.extraState, row);
    }

    return Array.from(map.entries())
      .map(([name, data]) => {
        const totals = totalsByGroup?.get(name);

        return {
          name,
          requests: data.requests,
          gross: totals?.gross ?? 0,
          discount: totals?.discount ?? 0,
          net: totals?.net ?? 0,
          aicGrossAmount: totals?.aicGrossAmount ?? 0,
          products: getPopulatedProductCosts(data.productBuckets),
          ...getExtraFields(data.extraState),
        };
      })
      .sort((a, b) => b.net - a.net);
  }, [createExtraState, getExtraFields, getGroupName, rows, totalsByGroup, updateExtraState]);
}
