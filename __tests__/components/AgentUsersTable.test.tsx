import { fireEvent, render, screen, within } from '@testing-library/react';

import { AgentUsageTableRow, AgentUsersTable } from '@/components/charts/AgentUsersTable';
import { getBillingCostLabels } from '@/utils/billingLabels';

function makeRow(partial: Partial<AgentUsageTableRow> & { user: string }): AgentUsageTableRow {
  return {
    quantity: 0,
    gross: 0,
    included: 0,
    additional: 0,
    quota: 'unknown',
    ...partial,
  };
}

describe('AgentUsersTable', () => {
  it('renders quota column and quantity formatting when not usage-based', () => {
    render(
      <AgentUsersTable
        tableTitle="Agent Users"
        rows={[makeRow({ user: 'test-user-one', quantity: 4, quota: 300 })]}
        isUsageBasedBilling={false}
        quantityColumnLabel="Premium Requests"
        costLabels={getBillingCostLabels(false)}
        showAll={false}
        onToggleShowAll={jest.fn()}
        previewCount={5}
      />
    );

    expect(screen.getByRole('heading', { name: 'Agent Users' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Premium Requests' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Quota' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Gross Amount' })).not.toBeInTheDocument();

    const row = screen.getByText('test-user-one').closest('tr') as HTMLElement;
    expect(within(row).getByText('4.0')).toBeInTheDocument();
    expect(within(row).getByText('300')).toBeInTheDocument();
  });

  it('renders billing columns and currency formatting when usage-based', () => {
    render(
      <AgentUsersTable
        tableTitle="Code Review Users"
        rows={[makeRow({ user: 'test-user-one', quantity: 12.34, gross: 0.1234, included: 0.1, additional: 0.0234 })]}
        isUsageBasedBilling={true}
        quantityColumnLabel="AI Credits"
        costLabels={getBillingCostLabels(true)}
        showAll={false}
        onToggleShowAll={jest.fn()}
        previewCount={5}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Gross Amount' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Included Credits' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Additional usage' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Quota' })).not.toBeInTheDocument();

    const row = screen.getByText('test-user-one').closest('tr') as HTMLElement;
    expect(within(row).getByText('12.34')).toBeInTheDocument();
    expect(within(row).getByText('$0.12')).toBeInTheDocument();
    expect(within(row).getByText('-$0.10')).toBeInTheDocument();
    expect(within(row).getByText('$0.02')).toBeInTheDocument();
  });

  it('limits rows to preview count and toggles via the expand button', () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      makeRow({ user: `test-user-${index}`, quantity: index })
    );
    const onToggleShowAll = jest.fn();

    const { rerender } = render(
      <AgentUsersTable
        tableTitle="Agent Users"
        rows={rows}
        isUsageBasedBilling={false}
        quantityColumnLabel="Premium Requests"
        costLabels={getBillingCostLabels(false)}
        showAll={false}
        onToggleShowAll={onToggleShowAll}
        previewCount={5}
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    const toggle = screen.getByRole('button', { name: 'Show all 7 users' });
    fireEvent.click(toggle);
    expect(onToggleShowAll).toHaveBeenCalledTimes(1);

    rerender(
      <AgentUsersTable
        tableTitle="Agent Users"
        rows={rows}
        isUsageBasedBilling={false}
        quantityColumnLabel="Premium Requests"
        costLabels={getBillingCostLabels(false)}
        showAll={true}
        onToggleShowAll={onToggleShowAll}
        previewCount={5}
      />
    );

    expect(screen.getAllByRole('row')).toHaveLength(1 + 7);
    expect(screen.getByRole('button', { name: 'Show top 5' })).toBeInTheDocument();
  });

  it('always keeps the synthetic non-Copilot row visible in the preview', () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => makeRow({ user: `test-user-${index}`, quantity: 10 - index })),
      makeRow({ user: 'Non-Copilot Users', quantity: 1, quota: 0, isSyntheticNonCopilotRow: true }),
    ];

    render(
      <AgentUsersTable
        tableTitle="Code Review Users"
        rows={rows}
        isUsageBasedBilling={false}
        quantityColumnLabel="Premium Requests"
        costLabels={getBillingCostLabels(false)}
        showAll={false}
        onToggleShowAll={jest.fn()}
        previewCount={5}
      />
    );

    expect(screen.getByText('Non-Copilot Users')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
  });
});
