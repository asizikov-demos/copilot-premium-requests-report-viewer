import type { CSSProperties } from 'react';

import { bgColor, borderColor, fgColor, shadow } from '@/constants/primerTokens';

export const chartTooltipContentStyle: CSSProperties = {
  backgroundColor: bgColor.default,
  borderRadius: 6,
  color: fgColor.default,
  boxShadow: shadow.floatingSmall,
  padding: '10px 14px',
  fontSize: 12,
  border: `1px solid ${borderColor.default}`,
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: fgColor.default,
  fontWeight: 600,
  marginBottom: 6,
  fontSize: 12,
  borderBottom: `1px solid ${borderColor.muted}`,
  paddingBottom: 6,
};

export function utcDateTickFormatter(value: string): string {
  const date = new Date(value);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

export function utcDateLabelFormatter(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    throw new TypeError('Expected UTC date formatter value to be a string, number, or Date.');
  }

  const date = new Date(value);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}
