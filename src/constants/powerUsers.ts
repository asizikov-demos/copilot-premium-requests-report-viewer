export const DEFAULT_MIN_REQUESTS = 20;
export const MAX_MIN_REQUESTS = 10000;
export const DEBOUNCE_DELAY_MS = 300;
export const MAX_POWER_USERS_DISPLAYED = 20;

// Weight documentation centralization to avoid magic numbers scattered in UI
export const POWER_USER_SCORE_WEIGHTS = Object.freeze({
  diversity: 30,
  specialFeatures: 20,
  vision: 15,
  balance: 35,
  total: 100
});

export const POWER_USER_SCORE_LABELS: Record<keyof typeof POWER_USER_SCORE_WEIGHTS | 'total', string> = {
  diversity: 'Model Diversity',
  specialFeatures: 'Special Features',
  vision: 'Vision Models',
  balance: 'Balance Score',
  total: 'Total'
};

// Formatting helpers kept simple (no date logic here to respect UTC central rules elsewhere)
export function formatRequestCount(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}
