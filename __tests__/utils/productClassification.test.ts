import {
  classifyProductCategory,
  getProductDisplayLabel,
  isCodeReviewModel,
  isCodingAgentModel,
  NON_COPILOT_CODE_REVIEW_PRODUCT_CATEGORY,
  isSparkProduct,
} from '@/utils/productClassification';

describe('product classification', () => {
  test('detects coding agent aliases', () => {
    expect(isCodingAgentModel('Copilot Coding Agent')).toBe(true);
    expect(isCodingAgentModel('Padawan Session')).toBe(true);
    expect(isCodingAgentModel('Code Review')).toBe(false);
  });

  test('detects code review models', () => {
    expect(isCodeReviewModel('Code Review')).toBe(true);
    expect(isCodeReviewModel('code review session')).toBe(true);
    expect(isCodeReviewModel('GPT-4.1')).toBe(false);
  });

  test('detects spark from explicit product and sku metadata', () => {
    expect(isSparkProduct('spark', 'spark_premium_request')).toBe(true);
    expect(isSparkProduct('copilot', 'copilot_premium_request')).toBe(false);
    expect(isSparkProduct()).toBe(false);
  });

  test('classifies models into product buckets', () => {
    expect(classifyProductCategory('Coding Agent')).toBe('Coding Agent');
    expect(classifyProductCategory('Padawan')).toBe('Coding Agent');
    expect(classifyProductCategory('Code Review')).toBe('Code Review');
    expect(classifyProductCategory('Code Review', undefined, undefined, { isNonCopilotUsage: true, usageBucket: 'non_copilot_code_review' })).toBe(NON_COPILOT_CODE_REVIEW_PRODUCT_CATEGORY);
    expect(classifyProductCategory('gpt-4.1')).toBe('Copilot');
    expect(classifyProductCategory('Spark Helper')).toBe('Copilot');
    expect(classifyProductCategory('Claude Sonnet 4.5', 'spark', 'spark_premium_request')).toBe('Spark');
  });

  test('maps product categories to display labels', () => {
    expect(getProductDisplayLabel('Coding Agent')).toBe('Cloud Agent');
    expect(getProductDisplayLabel('Spark')).toBe('Spark');
    expect(getProductDisplayLabel(NON_COPILOT_CODE_REVIEW_PRODUCT_CATEGORY)).toBe('Code Review for Non-Copilot Users');
  });
});
