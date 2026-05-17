import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { BillingGroupRow, BillingGroupTable } from '@/components/BillingGroupTable';

const product = {
  category: 'Copilot' as const,
  label: 'Copilot',
  requests: 3,
  gross: 1.2,
  discount: 0.2,
  net: 1,
  aicQuantity: 25,
  aicGrossAmount: 0.25,
};

interface OrganizationRow extends BillingGroupRow {
  users: number;
}

describe('BillingGroupTable', () => {
  it('renders extra columns and expandable product billing breakdowns', () => {
    const rows: OrganizationRow[] = [{
      name: 'example-org',
      users: 2,
      requests: 3,
      gross: 1.2,
      discount: 0.2,
      net: 1,
      aicGrossAmount: 0.25,
      products: [product],
    }];

    render(
      <BillingGroupTable<OrganizationRow>
        title="Organizations"
        countLabel="organization"
        primaryHeader="Organization"
        detailsIdPrefix="organization-details"
        rows={rows}
        hasCosts
        hasAicGross
        extraColumns={[{ header: 'Users', render: (row) => row.users.toLocaleString() }]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'example-org' }));

    expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Gross' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Discount' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Net' })).toHaveLength(2);
    expect(screen.getByText('Copilot')).toBeInTheDocument();
    expect(screen.getAllByText('$0.25')).toHaveLength(2);
    expect(screen.getAllByText('$1.00')).toHaveLength(2);
  });

  it('renders cost center rows without organization-specific columns', () => {
    const rows: BillingGroupRow[] = [{
      name: 'Engineering',
      requests: 3,
      gross: 1.2,
      discount: 0.2,
      net: 1,
      aicGrossAmount: 0.25,
      products: [product],
    }];

    render(
      <BillingGroupTable
        title="Cost Centers"
        countLabel="cost center"
        primaryHeader="Cost Center"
        detailsIdPrefix="cost-center-details"
        rows={rows}
        hasCosts
        hasAicGross={false}
      />
    );

    const table = screen.getByRole('columnheader', { name: 'Cost Center' }).closest('table');
    expect(table).not.toBeNull();
    expect(within(table!).queryByRole('columnheader', { name: 'Users' })).not.toBeInTheDocument();
    expect(within(table!).queryByRole('columnheader', { name: 'AI Credits Gross' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Engineering' }));

    expect(screen.getByText('Copilot')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Gross' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Discount' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Net' })).toHaveLength(2);
  });
});
