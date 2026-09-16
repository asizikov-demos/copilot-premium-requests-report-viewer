import type { TokenCounts } from '@/types/tokens';

const TOKEN_COLUMNS = [
  ['inputTokens', 'input', 'total_input_tokens'],
  ['outputTokens', 'output', 'total_output_tokens'],
  ['cacheReadTokens', 'cache_read', 'total_cache_read_tokens'],
  ['cacheWriteTokens', 'cache_write', 'total_cache_creation_tokens'],
] as const;

export const TOKEN_FIELDS = TOKEN_COLUMNS.map(([field]) => field);

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null &&
    !(typeof value === 'string' && value.trim() === '');
}

export function parseTokenCounts(
  raw: Record<string, unknown>,
  warnings: string[]
): TokenCounts {
  const counts: TokenCounts = {};
  const parseCount = (column: string): number | undefined => {
    const value = raw[column];
    if (!isPresent(value)) return undefined;

    const count = typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;
    if (!Number.isSafeInteger(count) || count < 0) {
      warnings.push(`Invalid token count in ${column} for user=${raw.username} date=${raw.date}`);
      return undefined;
    }
    return count;
  };

  for (const [field, column, alias] of TOKEN_COLUMNS) {
    const current = parseCount(column);
    const legacy = parseCount(alias);
    if (current !== undefined && legacy !== undefined && current !== legacy) {
      warnings.push(`Conflicting token counts in ${column} and ${alias} for user=${raw.username} date=${raw.date}; using ${column}`);
    }
    // A supplied canonical value wins even if invalid; do not conceal bad data.
    const count = isPresent(raw[column]) ? current : legacy;
    if (count !== undefined) counts[field] = count;
  }
  return counts;
}
