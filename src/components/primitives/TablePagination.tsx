import { Pagination } from '@primer/react';

export const DEFAULT_TABLE_PAGE_SIZE = 50;

interface TablePaginationProps {
  ariaLabel: string;
  currentPage: number;
  itemCount: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export function TablePagination({
  ariaLabel,
  currentPage,
  itemCount,
  onPageChange,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
}: TablePaginationProps) {
  const pageCount = Math.ceil(itemCount / pageSize);
  if (pageCount <= 1) {
    return null;
  }

  const activePage = Math.min(Math.max(currentPage, 0), pageCount - 1);
  const firstItem = activePage * pageSize + 1;
  const lastItem = Math.min((activePage + 1) * pageSize, itemCount);

  return (
    <div className="bg-(--bgColor-default) px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-(--borderColor-default)">
      <p className="text-sm text-(--fgColor-muted)">
        {firstItem}–{lastItem} of {itemCount}
      </p>
      <Pagination
        aria-label={ariaLabel}
        currentPage={activePage + 1}
        pageCount={pageCount}
        onPageChange={(_event, page) => onPageChange(page - 1)}
        renderPage={({ key, children, className, onClick, 'aria-label': pageLabel, 'aria-current': ariaCurrent }) => (
          <button
            key={key}
            type="button"
            className={className}
            onClick={onClick}
            aria-label={pageLabel}
            aria-current={ariaCurrent}
          >
            {children}
          </button>
        )}
      />
    </div>
  );
}
