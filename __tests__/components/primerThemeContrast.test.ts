import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  chartTooltipContentStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
} from '@/components/charts/chartTooltipStyles';
import { bgColor, fgColor } from '@/constants/primerTokens';

function luminance(hex: string): number {
  const rgb = hex.slice(1).match(/../g);
  if (!rgb || rgb.length !== 3) throw new Error(`Expected an opaque RGB color, got ${hex}`);
  const [red, green, blue] = rgb.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

describe.each(['light', 'dark-dimmed'])('%s chart contrast', (theme) => {
  const sheet = readFileSync(join(dirname(require.resolve('@primer/primitives/package.json')), `dist/css/functional/themes/${theme}.css`), 'utf8');
  const tokens = new Map(Array.from(sheet.matchAll(/--([\w-]+):\s*([^;]+);/g), (match) => [match[1], match[2].trim()]));
  const resolve = (value: string): string => {
    const variable = /^var\(--([\w-]+)\)$/.exec(value);
    if (!variable) return value;
    const token = tokens.get(variable[1]);
    if (!token) throw new Error(`Missing ${variable[1]} in ${theme}`);
    return resolve(token);
  };
  const contrast = (foreground: string, background: string) => {
    const values = [luminance(resolve(foreground)), luminance(resolve(background))];
    return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
  };

  it('keeps backed treemap/distribution labels, tooltip items and legend text readable', () => {
    expect(contrast(fgColor.default, bgColor.default)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fgColor.default, bgColor.muted)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fgColor.muted, bgColor.default)).toBeGreaterThanOrEqual(4.5);
    expect(chartTooltipContentStyle.backgroundColor).toBe(bgColor.default);
    for (const style of [chartTooltipContentStyle, chartTooltipLabelStyle, chartTooltipItemStyle]) {
      expect(contrast(String(style.color), String(chartTooltipContentStyle.backgroundColor))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
