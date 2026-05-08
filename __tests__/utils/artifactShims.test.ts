import { calculateSpecialFeaturesScore } from '@/utils/analytics/artifactShims';

describe('calculateSpecialFeaturesScore', () => {
  test('scores each special feature once using canonical product classification', () => {
    expect(calculateSpecialFeaturesScore([
      'Code Review',
      'code review session',
      'Copilot Coding Agent',
      'spark'
    ])).toBe(20);
  });

  test('does not classify unrelated model names as coding agent usage', () => {
    expect(calculateSpecialFeaturesScore(['Legacy Assistant Session'])).toBe(0);
  });
});
