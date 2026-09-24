import { fireEvent, render, screen, within } from '@testing-library/react';

import { AgentUsersTable, type AgentUsageTableRow } from '@/components/charts/AgentUsersTable';
import { getBillingCostLabels } from '@/utils/billingLabels';

const row = (user: string, quantity: number): AgentUsageTableRow => ({
  user,
  quantity,
  gross: quantity * .01,
  included: 0,
  additional: quantity * .01,
});

describe('AgentUsersTable', () => {
  it('renders fractional AI-credit quantities without cost columns when billing is unavailable', () => {
    render(
      <AgentUsersTable
        tableTitle="Agent Users"
        rows={[row('test-user-one', 4.25)]}
        showCosts={false}
        quantityColumnLabel="AI Credits"
        costLabels={getBillingCostLabels()}
        showAll={false}
        onToggleShowAll={jest.fn()}
        previewCount={5}
      />
    );
    expect(screen.getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Gross Amount' })).not.toBeInTheDocument();
    expect(within(screen.getByText('test-user-one').closest('tr')!).getByText('4.25')).toBeInTheDocument();
  });

  it('renders AI-credit billing columns with supplied net and included amounts', () => {
    render(
      <AgentUsersTable
        tableTitle="Code Review Users"
        rows={[{ ...row('test-user-one', 12.34), gross: .1234, included: .1, additional: .0234 }]}
        showCosts
        quantityColumnLabel="AI Credits"
        costLabels={getBillingCostLabels()}
        showAll={false}
        onToggleShowAll={jest.fn()}
        previewCount={5}
      />
    );
    expect(screen.getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
    const userRow = screen.getByText('test-user-one').closest('tr')!;
    expect(within(userRow).getByText('$0.12')).toBeInTheDocument();
    expect(within(userRow).getByText('-$0.10')).toBeInTheDocument();
    expect(within(userRow).getByText('$0.02')).toBeInTheDocument();
  });

  it('previews first rows and expands via the toggle', () => {
    const rows = Array.from({ length: 7 }, (_, index) => row(`test-user-${index + 1}`, index + 1));
    const onToggleShowAll = jest.fn();
    const props = {
      tableTitle: 'Agent Users',
      rows,
      showCosts: false,
      quantityColumnLabel: 'AI Credits',
      costLabels: getBillingCostLabels(),
      onToggleShowAll,
      previewCount: 5,
    };
    const { rerender } = render(<AgentUsersTable {...props} showAll={false} />);
    expect(screen.getAllByRole('row')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 7 users' }));
    expect(onToggleShowAll).toHaveBeenCalledTimes(1);
    rerender(<AgentUsersTable {...props} showAll />);
    expect(screen.getAllByRole('row')).toHaveLength(8);
  });
});
