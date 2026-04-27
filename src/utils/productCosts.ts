import type { ProcessedData } from '@/types/csv';

import { classifyProductCategory, getProductDisplayLabel, ProductCategory } from '@/utils/productClassification';

export interface ProductCost {
  category: ProductCategory;
  label: string;
  requests: number;
  gross: number;
  discount: number;
  net: number;
  aicQuantity: number;
  aicGrossAmount: number;
}

export const PRODUCT_CATEGORY_ORDER: ProductCategory[] = [
  'Copilot',
  'Spark',
  'Coding Agent',
  'Code Review',
  'Code Review for Non-Copilot Users',
];

function createEmptyProductCost(category: ProductCategory): ProductCost {
  return {
    category,
    label: getProductDisplayLabel(category),
    requests: 0,
    gross: 0,
    discount: 0,
    net: 0,
    aicQuantity: 0,
    aicGrossAmount: 0,
  };
}

export function createEmptyProductCostMap(): Map<ProductCategory, ProductCost> {
  return new Map<ProductCategory, ProductCost>(
    PRODUCT_CATEGORY_ORDER.map((category) => [category, createEmptyProductCost(category)])
  );
}

export function accumulateProductCost(
  buckets: Map<ProductCategory, ProductCost>,
  row: Pick<ProcessedData, 'model' | 'product' | 'sku' | 'requestsUsed' | 'grossAmount' | 'discountAmount' | 'netAmount' | 'aicQuantity' | 'aicGrossAmount' | 'isNonCopilotUsage' | 'usageBucket'>
): void {
  const category = classifyProductCategory(row.model, row.product, row.sku, {
    isNonCopilotUsage: row.isNonCopilotUsage,
    usageBucket: row.usageBucket,
  });
  const bucket = buckets.get(category);

  if (!bucket) {
    return;
  }

  bucket.requests += row.requestsUsed;
  bucket.gross += row.grossAmount ?? 0;
  bucket.discount += row.discountAmount ?? 0;
  bucket.net += row.netAmount ?? 0;
  bucket.aicQuantity += row.aicQuantity ?? 0;
  bucket.aicGrossAmount += row.aicGrossAmount ?? 0;
}

export function getPopulatedProductCosts(buckets: Map<ProductCategory, ProductCost>): ProductCost[] {
  return PRODUCT_CATEGORY_ORDER
    .map((category) => buckets.get(category))
    .filter((bucket): bucket is ProductCost => Boolean(bucket && bucket.requests > 0));
}

export function aggregateProductCosts(rows: ProcessedData[]): ProductCost[] {
  const buckets = createEmptyProductCostMap();

  for (const row of rows) {
    accumulateProductCost(buckets, row);
  }

  return getPopulatedProductCosts(buckets);
}
