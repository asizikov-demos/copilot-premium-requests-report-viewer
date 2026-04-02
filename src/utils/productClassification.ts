export type ProductCategory = 'Copilot' | 'Coding Agent' | 'Code Review' | 'Spark';

function normalizeProductValue(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

export function isCodingAgentModel(model: string): boolean {
  const normalizedModel = model.toLowerCase();
  return normalizedModel.includes('coding agent') || normalizedModel.includes('padawan');
}

export function isCodeReviewModel(model: string): boolean {
  return model.toLowerCase().includes('code review');
}

export function isSparkProduct(product?: string, sku?: string): boolean {
  const normalizedProduct = normalizeProductValue(product);
  const normalizedSku = normalizeProductValue(sku);

  return normalizedProduct === 'spark'
    || normalizedSku === 'spark_premium_request';
}

export function classifyProductCategory(model: string, product?: string, sku?: string): ProductCategory {
  if (isSparkProduct(product, sku)) {
    return 'Spark';
  }

  if (isCodingAgentModel(model)) {
    return 'Coding Agent';
  }

  if (isCodeReviewModel(model)) {
    return 'Code Review';
  }

  return 'Copilot';
}

export function getProductDisplayLabel(category: ProductCategory): string {
  return category === 'Coding Agent' ? 'Cloud Agent' : category;
}