import { fireEvent, render, screen } from '@testing-library/react';
import { SortableColumnHeader } from '@/components/primitives/SortableColumnHeader';

function renderHeader(props: Partial<React.ComponentProps<typeof SortableColumnHeader>> = {}) {
  const onSort = jest.fn();
  render(
    <table>
      <thead>
        <tr>
          <SortableColumnHeader label="Quota" active={false} direction="desc" onSort={onSort} {...props} />
        </tr>
      </thead>
    </table>
  );
  return onSort;
}

describe('SortableColumnHeader', () => {
  it('exposes a keyboard-operable sort button', () => {
    const onSort = renderHeader();

    const button = screen.getByRole('button', { name: 'Quota' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it.each([
    [false, 'desc', 'none'],
    [true, 'desc', 'descending'],
    [true, 'asc', 'ascending'],
  ] as const)('maps active=%s direction=%s to aria-sort=%s', (active, direction, expected) => {
    renderHeader({ active, direction });

    expect(screen.getByRole('columnheader', { name: 'Quota' })).toHaveAttribute('aria-sort', expected);
  });
});
