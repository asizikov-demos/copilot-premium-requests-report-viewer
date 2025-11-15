/**
 * Generates consistent colors for model visualizations across the application.
 * Uses a predefined palette to ensure models are colored consistently.
 */
export function generateModelColors(models: string[]): Record<string, string> {
  const palette = [
    '#3B82F6', // blue-500
    '#EF4444', // red-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#8B5CF6', // violet-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
    '#F97316', // orange-500
    '#EC4899', // pink-500
    '#6366F1', // indigo-500
    '#14B8A6', // teal-500
    '#F43F5E', // rose-500
  ];
  
  const result: Record<string, string> = {};
  models.forEach((model, index) => {
    result[model] = palette[index % palette.length];
  });
  return result;
}
