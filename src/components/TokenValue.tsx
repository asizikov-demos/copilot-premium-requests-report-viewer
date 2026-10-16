import { dataVizColor } from '@/constants/primerTokens';
import type { TokenCounts } from '@/types/tokens';
import type { TokenTotals } from '@/utils/ingestion';

export const TOKEN_COLUMNS = [
  { field: 'inputTokens', label: 'Input Tokens', color: dataVizColor('blue') },
  { field: 'outputTokens', label: 'Output Tokens', color: dataVizColor('green') },
  { field: 'cacheWriteTokens', label: 'Cache Write Tokens', color: dataVizColor('orange') },
  { field: 'cacheReadTokens', label: 'Cache Read Tokens', color: dataVizColor('gray') },
] as const;

export function TokenValue({ totals, field, overall }: {
  totals?: TokenTotals;
  field: keyof TokenCounts;
  overall?: TokenTotals;
}) {
  const count = totals?.[field];
  if (count === undefined) return <span aria-label="Not reported">—</span>;
  const reportedRows = totals?.reportedRows[field] ?? 0;
  const partial = reportedRows < (totals?.rowCount ?? 0);
  const denominator = overall?.[field];
  return (
    <>
      {count.toLocaleString()}
      {denominator !== undefined && denominator > 0 && (
        <span className="ml-1 text-xs">({(count / denominator * 100).toFixed(1)}%)</span>
      )}
      {partial && (
        <span className="ml-1 text-xs" title={`${reportedRows} of ${totals?.rowCount} rows reported this token count`}>
          (partial)
        </span>
      )}
    </>
  );
}
