import { fireEvent, render, screen, within } from '@testing-library/react';

import { BillingGroupDetailsView } from '@/components/BillingGroupDetailsView';
import type { ProcessedData } from '@/types/csv';
import { getBillingCostLabels } from '@/utils/billingLabels';

function makeRow(overrides: Partial<ProcessedData> & { dateKey: string }): ProcessedData {
  const timestamp = new Date(`${overrides.dateKey}T00:00:00Z`);

  return {
    timestamp,
    user: 'test-user-one',
    model: 'Test Model',
    requestsUsed: 1,
    exceedsQuota: false,
    totalQuota: '300',
    quotaValue: 300,
    iso: timestamp.toISOString(),
    monthKey: overrides.dateKey.slice(0, 7),
    epoch: timestamp.getTime(),
    organization: 'test-org-one',
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
    ...overrides,
  };
}

const rows: ProcessedData[] = [
  makeRow({
    dateKey: '2026-03-01',
    user: 'test-user-one',
    model: 'Test Model',
    requestsUsed: 4,
    grossAmount: 0.16,
    discountAmount: 0.04,
    netAmount: 0.12,
  }),
  makeRow({
    dateKey: '2026-03-03',
    user: 'test-user-two',
    model: 'Coding Agent model',
    requestsUsed: 2,
    grossAmount: 0.08,
    discountAmount: 0,
    netAmount: 0.08,
  }),
];

function renderView(onBack = jest.fn()) {
  render(
    <BillingGroupDetailsView
      groupName="test-org-one"
      groupLabel="organization"
      groupsLabel="organizations"
      detailIdPrefix="organization-daily-details"
      rows={rows}
      isUsageBasedBilling={false}
      quantityColumnLabel="Requests"
      costLabels={getBillingCostLabels(false)}
      hasAicGross={false}
      onBack={onBack}
    />
  );

  return onBack;
}

describe('BillingGroupDetailsView', () => {
  it('renders the group header with aggregated totals', () => {
    renderView();

    expect(screen.getByRole('button', { name: /test-org-one/ })).toBeInTheDocument();
    expect(screen.getByText(/2 users/)).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Summary' })).getByText('6.00')).toBeInTheDocument();
  });

  it('breaks spend down per product', () => {
    renderView();

    const productTable = within(screen.getByRole('table', { name: 'Spend per product' }));
    expect(productTable.getByText('Copilot')).toBeInTheDocument();
    expect(productTable.getByText('Cloud Agent')).toBeInTheDocument();
    expect(productTable.getByText('$0.12')).toBeInTheDocument();
    expect(productTable.getAllByText('$0.08').length).toBeGreaterThan(0);
  });

  it('lists daily consumption including days without usage and expands product details', () => {
    renderView();

    const dailyTable = within(screen.getByRole('table', { name: 'Daily consumption breakdown' }));
    // Mar 1 through Mar 3 inclusive, with Mar 2 filled as a zero-usage day.
    expect(dailyTable.getAllByRole('row')).toHaveLength(4);

    fireEvent.click(dailyTable.getByRole('button', { name: /Mar 1, 2026/ }));

    const detailRow = within(document.getElementById('organization-daily-details-0') as HTMLElement);
    expect(detailRow.getByText('Copilot')).toBeInTheDocument();
    expect(detailRow.getByText('4.00')).toBeInTheDocument();
  });

  it('navigates back to the organizations list', () => {
    const onBack = renderView();

    fireEvent.click(screen.getByRole('button', { name: 'organizations' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('labels the breadcrumb and detail ids for cost centers', () => {
    const onBack = jest.fn();

    render(
      <BillingGroupDetailsView
        groupName="test-cost-center-one"
        groupLabel="cost center"
        groupsLabel="cost centers"
        detailIdPrefix="cost-center-daily-details"
        rows={rows.map((row) => ({ ...row, costCenter: 'test-cost-center-one' }))}
        isUsageBasedBilling={false}
        quantityColumnLabel="Requests"
        costLabels={getBillingCostLabels(false)}
        hasAicGross={false}
        onBack={onBack}
      />
    );

    expect(screen.getByRole('button', { name: /test-cost-center-one/ })).toBeInTheDocument();
    expect(screen.getByText(/attributed to this cost center/)).toBeInTheDocument();

    const dailyTable = within(screen.getByRole('table', { name: 'Daily consumption breakdown' }));
    fireEvent.click(dailyTable.getByRole('button', { name: /Mar 1, 2026/ }));
    expect(document.getElementById('cost-center-daily-details-0')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'cost centers' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  describe('users table', () => {
    function renderWithUsers() {
      render(
        <BillingGroupDetailsView
          groupName="test-cost-center-one"
          groupLabel="cost center"
          groupsLabel="cost centers"
          detailIdPrefix="cost-center-daily-details"
          rows={rows}
          isUsageBasedBilling={false}
          quantityColumnLabel="Requests"
          costLabels={getBillingCostLabels(false)}
          hasAicGross={false}
          showUsers
          onBack={jest.fn()}
        />
      );
    }

    it('is hidden unless enabled', () => {
      renderView();

      expect(screen.queryByRole('table', { name: 'Users' })).not.toBeInTheDocument();
    });

    it('aggregates spend per user sorted by net descending', () => {
      renderWithUsers();

      const usersTable = within(screen.getByRole('table', { name: 'Users' }));
      const bodyRows = usersTable.getAllByRole('row').slice(1);

      expect(bodyRows).toHaveLength(2);
      expect(within(bodyRows[0]).getByText('test-user-one')).toBeInTheDocument();
      expect(within(bodyRows[0]).getByText('4.00')).toBeInTheDocument();
      expect(within(bodyRows[0]).getByText('$0.12')).toBeInTheDocument();
      expect(within(bodyRows[1]).getByText('test-user-two')).toBeInTheDocument();
    });

    it('excludes non-attributable usage rows', () => {
      render(
        <BillingGroupDetailsView
          groupName="test-cost-center-one"
          groupLabel="cost center"
          groupsLabel="cost centers"
          detailIdPrefix="cost-center-daily-details"
          rows={[
            ...rows,
            makeRow({
              dateKey: '2026-03-02',
              user: 'test-user-three',
              isNonCopilotUsage: true,
              usageBucket: 'non_copilot_code_review',
            }),
          ]}
          isUsageBasedBilling={false}
          quantityColumnLabel="Requests"
          costLabels={getBillingCostLabels(false)}
          hasAicGross={false}
          showUsers
          onBack={jest.fn()}
        />
      );

      const usersTable = within(screen.getByRole('table', { name: 'Users' }));
      expect(usersTable.queryByText('test-user-three')).not.toBeInTheDocument();
    });

    it('filters users by the search query', () => {
      renderWithUsers();

      fireEvent.change(screen.getByRole('textbox', { name: 'Search users' }), {
        target: { value: 'user-two' },
      });

      const usersTable = within(screen.getByRole('table', { name: 'Users' }));
      expect(usersTable.getByText('test-user-two')).toBeInTheDocument();
      expect(usersTable.queryByText('test-user-one')).not.toBeInTheDocument();
      expect(screen.getByText(/Showing 1 of 2 users/)).toBeInTheDocument();
    });

    it('paginates users in 50-row pages', () => {
      const paginatedRows = Array.from({ length: 51 }, (_, index) => (
        makeRow({
          dateKey: '2026-03-01',
          user: `test-user-${index.toString().padStart(3, '0')}`,
          requestsUsed: 1,
        })
      ));

      render(
        <BillingGroupDetailsView
          groupName="test-cost-center-one"
          groupLabel="cost center"
          groupsLabel="cost centers"
          detailIdPrefix="cost-center-daily-details"
          rows={paginatedRows}
          isUsageBasedBilling={false}
          quantityColumnLabel="Requests"
          costLabels={getBillingCostLabels(false)}
          hasAicGross={false}
          showUsers
          onBack={jest.fn()}
        />
      );

      const usersTable = within(screen.getByRole('table', { name: 'Users' }));
      expect(usersTable.getAllByRole('row')).toHaveLength(51);
      expect(usersTable.getByText('test-user-000')).toBeInTheDocument();
      expect(usersTable.queryByText('test-user-050')).not.toBeInTheDocument();
      expect(screen.getByText('1–50 of 51')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Next users page' }));

      expect(usersTable.getAllByRole('row')).toHaveLength(2);
      expect(usersTable.getByText('test-user-050')).toBeInTheDocument();
      expect(screen.getByText('51–51 of 51')).toBeInTheDocument();
    });

    it('shows an empty state when no user matches the search query', () => {
      renderWithUsers();

      fireEvent.change(screen.getByRole('textbox', { name: 'Search users' }), {
        target: { value: 'no-such-user' },
      });

      expect(screen.queryByRole('table', { name: 'Users' })).not.toBeInTheDocument();
      expect(screen.getByText('No users match "no-such-user"')).toBeInTheDocument();
    });
  });
});
