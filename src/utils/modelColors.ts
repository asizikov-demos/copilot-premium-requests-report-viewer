import { dataVizColor, dataVizTextColor, type DataVizHue } from '@/constants/primerTokens';

/**
 * Model-specific color palette for consistent data visualization.
 * Colors use Primer data visualization tokens and are grouped by vendor/family where possible.
 */

const MODEL_HUES: Record<string, DataVizHue> = {
  // Claude models
  'Claude Sonnet 4.5': 'purple',
  'Claude Opus 4.5': 'red',
  'Claude Sonnet 4': 'plum',
  'Claude Opus 4.1': 'pink',
  'Claude Haiku 4.5': 'auburn',
  'Claude Sonnet 3.5': 'brown',
  'Claude Sonnet 3.6': 'brown',
  // GPT models
  'GPT-5': 'green',
  'GPT-5.1-Codex': 'pine',
  'GPT-5-Codex': 'teal',
  'GPT-4.1': 'lime',
  'GPT-4': 'olive',
  'GPT-4o': 'lime',
  'Auto: GPT-5': 'lemon',
  // Gemini models
  'Gemini 3 Pro': 'blue',
  'Gemini 3.5 Pro': 'blue',
  'Gemini 2.0 Flash': 'gray',
  'Gemini 2.5 Pro': 'gray',
  // Agent/special models
  'Coding Agent model': 'orange',
  'Code Review model': 'yellow',
  'Auto: Claude Sonnet': 'coral',
};

// Fallback palette for unknown models
const FALLBACK_HUES: DataVizHue[] = [
  'blue', 'green', 'orange', 'purple', 'red', 'teal', 'pink', 'lime', 'plum',
  'coral', 'pine', 'yellow', 'auburn', 'olive', 'brown', 'lemon', 'gray',
];

/**
 * Get the Primer data visualization hue for a model.
 * Returns a predefined hue for known models, or a consistent hash-based hue for unknown ones.
 */
export function getModelHue(model: string): DataVizHue {
  const hue = MODEL_HUES[model];
  if (hue) {
    return hue;
  }
  const hash = model.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_HUES[hash % FALLBACK_HUES.length];
}

/** Get a color for a specific model. */
export function getModelColor(model: string): string {
  return dataVizColor(getModelHue(model));
}

/** Get the foreground token that contrasts with `getModelColor(model)`. */
export function getModelTextColor(model: string): string {
  return dataVizTextColor(getModelHue(model));
}

/**
 * Generates consistent colors for model visualizations across the application.
 * Uses a predefined palette to ensure models are colored consistently.
 */
export function generateModelColors(models: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  models.forEach((model) => {
    result[model] = getModelColor(model);
  });
  return result;
}
