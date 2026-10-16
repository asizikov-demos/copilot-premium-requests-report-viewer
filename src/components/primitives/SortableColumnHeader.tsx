import type { ReactNode } from 'react';
import { SortAscIcon, SortDescIcon } from '@primer/octicons-react';

import type { SortDirection } from '@/hooks/useSortableTable';

interface SortableColumnHeaderProps {
  label: ReactNode;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Column header for a sortable table (Primer DataTable pattern): the `<th>` carries
 * `aria-sort` and wraps a real button so sorting works from the keyboard.
 */
export function SortableColumnHeader({
  label,
  active,
  direction,
  onSort,
  align = 'right',
  className = '',
}: SortableColumnHeaderProps) {
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const SortIcon = active && direction === 'desc' ? SortDescIcon : SortAscIcon;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`p-0 ${active ? 'bg-(--control-transparent-bgColor-selected)' : 'bg-(--bgColor-muted)'} ${className}`}
    >
      <button
        type="button"
        onClick={onSort}
        className={`group flex w-full items-center gap-2 px-4 py-3 text-xs font-semibold text-(--fgColor-muted) uppercase tracking-[0.05em] hover:bg-(--control-transparent-bgColor-hover) hover:text-(--fgColor-default) transition-colors duration-150 ${
          align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
        }`}
      >
        {label}
        <SortIcon
          size={16}
          className={`shrink-0 ${active ? '' : 'invisible group-hover:visible group-focus-visible:visible'}`}
        />
      </button>
    </th>
  );
}
