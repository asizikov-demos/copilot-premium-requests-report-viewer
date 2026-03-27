import { classifyProductCategory, isCodeReviewModel, isCodingAgentModel } from '@/utils/productClassification';

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

  test('classifies models into product buckets', () => {
    expect(classifyProductCategory('Coding Agent')).toBe('Coding Agent');
    expect(classifyProductCategory('Padawan')).toBe('Coding Agent');
    expect(classifyProductCategory('Code Review')).toBe('Code Review');
    expect(classifyProductCategory('gpt-4.1')).toBe('Copilot');
  });
});