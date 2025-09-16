import { DEFAULT_MIN_REQUESTS, MAX_MIN_REQUESTS, DEBOUNCE_DELAY_MS, MAX_POWER_USERS_DISPLAYED, POWER_USER_SCORE_WEIGHTS } from '@/constants/powerUsers';

describe('powerUsers constants', () => {
  test('threshold bounds are consistent', () => {
    expect(DEFAULT_MIN_REQUESTS).toBeLessThan(MAX_MIN_REQUESTS);
    expect(DEFAULT_MIN_REQUESTS).toBe(20);
    expect(MAX_MIN_REQUESTS).toBe(10000);
  });
  test('debounce delay sane', () => {
    expect(DEBOUNCE_DELAY_MS).toBeGreaterThanOrEqual(100);
    expect(DEBOUNCE_DELAY_MS).toBeLessThanOrEqual(1000);
  });
  test('max displayed positive', () => {
    expect(MAX_POWER_USERS_DISPLAYED).toBeGreaterThan(0);
  });
  test('weights sum to total', () => {
    const { diversity, specialFeatures, vision, balance, total } = POWER_USER_SCORE_WEIGHTS;
    expect(diversity + specialFeatures + vision + balance).toBe(total);
  });
});
