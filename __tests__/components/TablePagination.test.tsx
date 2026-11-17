import { render, screen } from '@testing-library/react';

import { paginateRows, TablePagination } from '@/components/primitives/TablePagination';

describe('paginateRows', () => {
  it('returns an empty first page when there are no rows', () => {
    expect(paginateRows([], 5)).toEqual({
      pageItems: [],
      activePage: 0,
      pageCount: 0,
    });
  });

  it('clamps pages beyond the end of the rows', () => {
    expect(paginateRows(['one', 'two', 'three'], 5, 2)).toEqual({
      pageItems: ['three'],
      activePage: 1,
      pageCount: 2,
    });
  });
});

it('uses the clamped page when rendering pagination controls', () => {
  render(
    <TablePagination
      ariaLabel="Test pagination"
      currentPage={5}
      itemCount={3}
      pageSize={2}
      onPageChange={jest.fn()}
    />
  );

  expect(screen.getByText('3–3 of 3')).toBeInTheDocument();
});
