/**
 * Model-specific color palette for consistent data visualization.
 * Colors are grouped by vendor/family for intuitive understanding.
 */

// Claude models - Purple/Violet spectrum
const CLAUDE_COLORS: Record<string, string> = {
  'Claude Sonnet 4.5': '#7c3aed',
  'Claude Opus 4.5': '#8b5cf6',
  'Claude Sonnet 4': '#a78bfa',
  'Claude Opus 4.1': '#c4b5fd',
  'Claude Haiku 4.5': '#ddd6fe',
  'Claude Sonnet 3.5': '#6d28d9',
  'Claude Sonnet 3.6': '#5b21b6',
};

// GPT models - Green/Teal spectrum
const GPT_COLORS: Record<string, string> = {
  'GPT-5': '#059669',
  'GPT-5.1-Codex': '#10b981',
  'GPT-5-Codex': '#34d399',
  'GPT-4.1': '#6ee7b7',
  'GPT-4': '#a7f3d0',
  'GPT-4o': '#047857',
  'Auto: GPT-5': '#065f46',
};

// Gemini models - Blue spectrum
const GEMINI_COLORS: Record<string, string> = {
  'Gemini 3 Pro': '#2563eb',
  'Gemini 3.5 Pro': '#3b82f6',
  'Gemini 2.0 Flash': '#60a5fa',
  'Gemini 2.5 Pro': '#1d4ed8',
};

// Agent/Special models - Indigo/Cyan spectrum
const AGENT_COLORS: Record<string, string> = {
  'Coding Agent model': '#6366f1',
  'Code Review model': '#8b5cf6',
  'Auto: Claude Sonnet': '#06b6d4',
};

// All model colors combined
const MODEL_COLORS: Record<string, string> = {
  ...CLAUDE_COLORS,
  ...GPT_COLORS,
  ...GEMINI_COLORS,
  ...AGENT_COLORS,
};

// Fallback palette for unknown models (matches chart design tokens)
const FALLBACK_PALETTE = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#2563eb', // blue
  '#65a30d', // lime
  '#dc2626', // red-600
  '#0891b2', // cyan-600
];

/**
 * Get a color for a specific model.
 * Returns a predefined color for known models, or generates a consistent color for unknown ones.
 */
export function getModelColor(model: string): string {
  if (MODEL_COLORS[model]) {
    return MODEL_COLORS[model];
  }
  // Generate consistent color for unknown models based on model name hash
  const hash = model.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
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
