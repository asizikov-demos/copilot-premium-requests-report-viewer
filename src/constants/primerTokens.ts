/**
 * Primer Primitives design tokens for JS consumers (Recharts props, SVG attributes, inline styles).
 * Values resolve to CSS variables imported from `@primer/primitives` in `src/app/globals.css`.
 * In className strings, prefer Tailwind's CSS-variable shorthand instead, e.g. `text-(--fgColor-muted)`.
 */

const cssVar = (name: string): string => `var(--${name})`;

export const fgColor = {
  default: cssVar('fgColor-default'),
  muted: cssVar('fgColor-muted'),
  accent: cssVar('fgColor-accent'),
  success: cssVar('fgColor-success'),
  attention: cssVar('fgColor-attention'),
  severe: cssVar('fgColor-severe'),
  danger: cssVar('fgColor-danger'),
  done: cssVar('fgColor-done'),
  onEmphasis: cssVar('fgColor-onEmphasis'),
} as const;

export const bgColor = {
  default: cssVar('bgColor-default'),
  muted: cssVar('bgColor-muted'),
  neutralMuted: cssVar('bgColor-neutral-muted'),
  accentMuted: cssVar('bgColor-accent-muted'),
  successEmphasis: cssVar('bgColor-success-emphasis'),
  dangerEmphasis: cssVar('bgColor-danger-emphasis'),
} as const;

export const borderColor = {
  default: cssVar('borderColor-default'),
  muted: cssVar('borderColor-muted'),
  emphasis: cssVar('borderColor-emphasis'),
} as const;

export const shadow = {
  floatingSmall: cssVar('shadow-floating-small'),
} as const;

export type DataVizHue =
  | 'auburn'
  | 'blue'
  | 'brown'
  | 'coral'
  | 'gray'
  | 'green'
  | 'lemon'
  | 'lime'
  | 'olive'
  | 'orange'
  | 'pine'
  | 'pink'
  | 'plum'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow';

/** Primer categorical data visualization color (`--data-{hue}-color-{emphasis|muted}`). */
export function dataVizColor(hue: DataVizHue, variant: 'emphasis' | 'muted' = 'emphasis'): string {
  return cssVar(`data-${hue}-color-${variant}`);
}

/**
 * Hues whose light-theme emphasis color has relative luminance above 0.179,
 * where `fgColor.default` gives more contrast than `fgColor.onEmphasis`.
 */
const DARK_TEXT_DATA_VIZ_HUES: ReadonlySet<DataVizHue> = new Set(['gray', 'green', 'orange', 'teal', 'yellow']);

/** Foreground token that contrasts best with `dataVizColor(hue, 'emphasis')`. */
export function dataVizTextColor(hue: DataVizHue): string {
  return DARK_TEXT_DATA_VIZ_HUES.has(hue) ? fgColor.default : fgColor.onEmphasis;
}

/**
 * Sequential scale derived from a Primer data visualization hue.
 * `intensity` is clamped to 0..1, where 0 is the muted tint and 1 is the emphasis color.
 */
export function dataVizScale(hue: DataVizHue, intensity: number): string {
  const percentage = Math.round(Math.min(Math.max(intensity, 0), 1) * 100);
  return `color-mix(in srgb, ${dataVizColor(hue)} ${percentage}%, ${dataVizColor(hue, 'muted')})`;
}
