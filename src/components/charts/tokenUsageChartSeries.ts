export const TOKEN_TYPE_SERIES = [
  { key: 'inputTokens', label: 'Input tokens', color: '#6366f1' },
  { key: 'outputTokens', label: 'Output tokens', color: '#22c55e' },
  { key: 'cacheReadTokens', label: 'Cache-read tokens', color: '#f59e0b' },
  { key: 'cacheWriteTokens', label: 'Cache-write tokens', color: '#06b6d4' },
] as const;

export type TokenTypeKey = (typeof TOKEN_TYPE_SERIES)[number]['key'];
