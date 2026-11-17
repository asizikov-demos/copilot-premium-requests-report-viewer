import type { NormalizedRow } from '@/utils/ingestion/types';
import { addBillingFields } from '@/utils/ingestion/billingAccumulator';

import { classifyProductCategory, getProductDisplayLabel, ProductCategory } from '@/utils/productClassification';

export interface ProductCost {
  category: ProductCategory;
  label: string;
  credits: number;
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
  'Code Quality',
];

function createEmptyProductCost(category: ProductCategory): ProductCost {
  return {
    category,
    label: getProductDisplayLabel(category),
    credits: 0,
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
  row: Pick<NormalizedRow, 'model' | 'product' | 'sku' | 'quantity' | 'grossAmount' | 'discountAmount' | 'netAmount' | 'aicQuantity' | 'aicGrossAmount'>
): void {
  const category = classifyProductCategory(row.model, row.product, row.sku);
  let bucket = buckets.get(category);
  if (!bucket) buckets.set(category, bucket = createEmptyProductCost(category));

  bucket.credits += row.quantity;
  addBillingFields(bucket, row);
}

export function getPopulatedProductCosts(buckets: Map<ProductCategory, ProductCost>): ProductCost[] {
  return PRODUCT_CATEGORY_ORDER
    .map((category) => buckets.get(category))
    .filter((bucket): bucket is ProductCost => Boolean(bucket && (bucket.credits > 0 || bucket.gross !== 0 || bucket.discount !== 0 || bucket.net !== 0)));
}

export function aggregateProductCosts(buckets: Map<ProductCategory, ProductCost>): ProductCost[] {
  return getPopulatedProductCosts(buckets);
}
