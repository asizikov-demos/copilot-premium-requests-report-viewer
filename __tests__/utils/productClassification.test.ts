import {
  classifyProductCategory,
  getProductDisplayLabel,
  isCodeQualityProduct,
  isCodeReviewModel,
  isCodingAgentModel,
  isSparkProduct,
} from '@/utils/productClassification';

describe('product classification', () => {
  test('detects coding agent models', () => {
    expect(isCodingAgentModel('Copilot Coding Agent')).toBe(true);
    expect(isCodingAgentModel('Code Review')).toBe(false);
  });

  test('detects code review models', () => {
    expect(isCodeReviewModel('Code Review')).toBe(true);
    expect(isCodeReviewModel('code review session')).toBe(true);
    expect(isCodeReviewModel('GPT-4.1')).toBe(false);
  });

  test('detects spark from explicit product and sku metadata', () => {
    expect(isSparkProduct('spark', 'copilot_ai_credit')).toBe(true);
    expect(isSparkProduct('copilot', 'copilot_ai_credit')).toBe(false);
    expect(isSparkProduct()).toBe(false);
  });

  test('detects code quality from explicit product and sku metadata', () => {
    expect(isCodeQualityProduct('code_quality', 'code_quality_ai_credit')).toBe(true);
    expect(isCodeQualityProduct('code_quality')).toBe(true);
    expect(isCodeQualityProduct(undefined, 'code_quality_ai_credit')).toBe(true);
    expect(isCodeQualityProduct('copilot', 'copilot_ai_credit')).toBe(false);
    expect(isCodeQualityProduct()).toBe(false);
  });

  test('classifies models into product buckets', () => {
    expect(classifyProductCategory('Coding Agent')).toBe('Coding Agent');
    expect(classifyProductCategory('Code Review')).toBe('Code Review');
    expect(classifyProductCategory('gpt-4.1')).toBe('Copilot');
    expect(classifyProductCategory('Spark Helper')).toBe('Copilot');
    expect(classifyProductCategory('Claude Sonnet 4.5', 'spark', 'copilot_ai_credit')).toBe('Spark');
    expect(classifyProductCategory('Claude Sonnet 4.6', 'code_quality', 'code_quality_ai_credit')).toBe('Code Quality');
  });

  test('maps product categories to display labels', () => {
    expect(getProductDisplayLabel('Coding Agent')).toBe('Cloud Agent');
    expect(getProductDisplayLabel('Spark')).toBe('Spark');
    expect(getProductDisplayLabel('Code Quality')).toBe('Code Quality');
    expect(getProductDisplayLabel('Code Review')).toBe('Code Review');
  });
});
