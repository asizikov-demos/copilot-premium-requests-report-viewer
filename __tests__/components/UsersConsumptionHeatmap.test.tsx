import { render, screen } from '@testing-library/react';

import { UsersConsumptionHeatmap } from '@/components/charts/UsersConsumptionHeatmap';

describe('UsersConsumptionHeatmap', () => {
  it('shows consumption density without quota references and scales to selected users', () => {
    const { container } = render(
      <UsersConsumptionHeatmap
        dailyCumulativeData={[{
          date: '2026-06-01',
          'test-user-one': 20,
          'test-user-two': 2000,
        }]}
        users={['test-user-one']}
      />
    );

    expect(screen.getByText('AI Credits Used')).toBeInTheDocument();
    expect(screen.getByText('User Density:')).toBeInTheDocument();
    expect(container.querySelector('line[stroke-dasharray]')).toBeNull();
    expect(container.textContent).not.toMatch(/Business|Enterprise|quota/);
    expect(container.querySelector('g > title')?.textContent).toContain('0-1 AI Credits');
    expect(screen.getByText(/19-20 AI Credits/)).toHaveTextContent('1 users (100.0%)');
    expect(container.querySelectorAll('g > rect')).toHaveLength(27);
  });

  it.each([
    { dailyCumulativeData: [], users: [] },
    {
      dailyCumulativeData: [{ date: '2026-06-01', 'test-user-one': 0 }],
      users: ['test-user-one'],
    },
  ])('keeps empty and zero-consumption charts finite', (props) => {
    const { container } = render(<UsersConsumptionHeatmap {...props} />);

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(screen.getByText('User Density:')).toBeInTheDocument();
  });
});
