import { render, screen, within } from '@testing-library/react';

import { UsersAicDistributionChart } from '@/components/charts/UsersAicDistributionChart';

it('keeps distribution percentages and every numeric heatmap label on neutral surfaces', () => {
  const { container } = render(<UsersAicDistributionChart users={[
    { user: 'test-user-one', quantity: 0, gross: 0 },
    { user: 'test-user-two', quantity: 1, gross: 1 },
    { user: 'test-user-three', quantity: 2, gross: 2 },
    { user: 'test-user-four', quantity: 4, gross: 4 },
    { user: 'test-user-five', quantity: 8, gross: 8 },
    { user: 'test-user-six', quantity: 16, gross: 16 },
  ]} />);

  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  for (const row of rows) {
    for (const cell of within(row).getAllByRole('cell').slice(1)) {
      expect(cell.firstElementChild).toHaveClass('bg-(--bgColor-default)', 'text-(--fgColor-default)');
    }
  }
  const percentages = container.querySelectorAll('div[title] > span');
  expect(percentages.length).toBeGreaterThan(0);
  for (const label of percentages) {
    expect(label).toHaveClass('bg-(--bgColor-default)', 'text-(--fgColor-default)');
  }
});
