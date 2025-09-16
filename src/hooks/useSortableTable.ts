import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<T extends string = string> {
  sortBy: T | null;
  sortDirection: SortDirection;
}

export interface UseSortableTableParams<Row, ColumnKey extends string> {
  data: Row[];
  defaultSort?: { column: ColumnKey; direction?: SortDirection };
  getSortableValue: (row: Row, column: ColumnKey) => number | string | undefined | null;
  columns: ColumnKey[]; // for validation / potential future features
  stable?: boolean; // default true
}

export interface UseSortableTableResult<Row, ColumnKey extends string> extends SortState<ColumnKey> {
  sortedData: Row[];
  handleSort: (column: ColumnKey) => void;
  isSorted: (column: ColumnKey) => boolean;
}

/**
 * Generic sorting hook with stable sort guarantee (default) and numeric-aware comparison.
 * Always returns a new sorted array when sort settings change; original data order preserved when unsorted.
 */
export function useSortableTable<Row, ColumnKey extends string>(params: UseSortableTableParams<Row, ColumnKey>): UseSortableTableResult<Row, ColumnKey> {
  const { data, defaultSort, getSortableValue, columns } = params;
  const stable = params.stable !== false; // default true

  const [sortBy, setSortBy] = useState<ColumnKey | null>(defaultSort?.column ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? 'desc');

  const handleSort = useCallback((column: ColumnKey) => {
    setSortBy(prev => {
      if (prev === column) {
        setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
        return prev; // keep same column
      }
      // new column
      setSortDirection('desc');
      return column;
    });
  }, []);

  const isSorted = useCallback((column: ColumnKey) => sortBy === column, [sortBy]);

  const sortedData = useMemo(() => {
    if (!sortBy) return data;
    const withIndex = data.map((row, index) => ({ row, index }));

    const compare = (a: typeof withIndex[number], b: typeof withIndex[number]) => {
      const aRaw = getSortableValue(a.row, sortBy);
      const bRaw = getSortableValue(b.row, sortBy);

      // Normalize values
      const aNum = typeof aRaw === 'string' ? parseFloat(aRaw) : aRaw;
      const bNum = typeof bRaw === 'string' ? parseFloat(bRaw) : bRaw;

      let cmp = 0;
      if (typeof aNum === 'number' && typeof bNum === 'number' && !Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        cmp = aNum - bNum;
      } else {
        const aStr = String(aRaw ?? '').toLowerCase();
        const bStr = String(bRaw ?? '').toLowerCase();
        if (aStr < bStr) cmp = -1; else if (aStr > bStr) cmp = 1; else cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    };

    withIndex.sort((a, b) => {
      const res = compare(a, b);
      if (res !== 0) return res;
      return stable ? a.index - b.index : 0;
    });
    return withIndex.map(w => w.row);
  }, [data, sortBy, sortDirection, getSortableValue, stable]);

  return { sortedData, sortBy, sortDirection, handleSort, isSorted };
}
