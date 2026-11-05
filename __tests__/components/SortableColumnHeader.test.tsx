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
    [false, 'desc', 'none', 'arrow-switch'],
    [true, 'desc', 'descending', 'triangle-down'],
    [true, 'asc', 'ascending', 'triangle-up'],
  ] as const)('maps active=%s direction=%s to aria-sort=%s and a decorative icon', (active, direction, expected, iconName) => {
    renderHeader({ active, direction });

    const header = screen.getByRole('columnheader', { name: 'Quota' });
    expect(header).toHaveAttribute('aria-sort', expected);
    const icon = header.querySelector('svg');
    expect(icon).toHaveClass(`octicon-${iconName}`);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '16');
    expect(icon).toHaveAttribute('height', '16');
  });
});
