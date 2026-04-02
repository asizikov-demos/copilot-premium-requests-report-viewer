import type { ProcessedData } from '@/types/csv';

import { classifyProductCategory, getProductDisplayLabel, ProductCategory } from '@/utils/productClassification';

export interface ProductCost {
  category: ProductCategory;
  label: string;
  requests: number;
  gross: number;
  discount: number;
  net: number;
}

export const PRODUCT_CATEGORY_ORDER: ProductCategory[] = ['Copilot', 'Spark', 'Coding Agent', 'Code Review'];

export function aggregateProductCosts(rows: ProcessedData[]): ProductCost[] {
  const buckets = new Map<ProductCategory, ProductCost>(
    PRODUCT_CATEGORY_ORDER.map((category) => [
      category,
      {
        category,
        label: getProductDisplayLabel(category),
        requests: 0,
        gross: 0,
        discount: 0,
        net: 0,
      },
    ])
  );

  for (const row of rows) {
    const category = classifyProductCategory(row.model, row.product, row.sku);
    const bucket = buckets.get(category);
    if (!bucket) {
      continue;
    }

    bucket.requests += row.requestsUsed;
    bucket.gross += row.grossAmount ?? 0;
    bucket.discount += row.discountAmount ?? 0;
    bucket.net += row.netAmount ?? 0;
  }

  return PRODUCT_CATEGORY_ORDER
    .map((category) => buckets.get(category))
    .filter((bucket): bucket is ProductCost => Boolean(bucket && bucket.requests > 0));
}