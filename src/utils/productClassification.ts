export type ProductCategory = 'Copilot' | 'Coding Agent' | 'Code Review';

export function isCodingAgentModel(model: string): boolean {
  const normalizedModel = model.toLowerCase();
  return normalizedModel.includes('coding agent') || normalizedModel.includes('padawan');
}

export function isCodeReviewModel(model: string): boolean {
  return model.toLowerCase().includes('code review');
}

export function classifyProductCategory(model: string): ProductCategory {
  if (isCodingAgentModel(model)) {
    return 'Coding Agent';
  }

  if (isCodeReviewModel(model)) {
    return 'Code Review';
  }

  return 'Copilot';
}