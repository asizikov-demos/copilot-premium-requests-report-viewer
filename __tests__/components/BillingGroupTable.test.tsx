import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { BillingGroupRow, BillingGroupTable } from '@/components/BillingGroupTable';

interface OrganizationBillingGroupRow extends BillingGroupRow {
  users: number;
}

const billingRow: OrganizationBillingGroupRow = {
  name: 'test-org-one',
  users: 2,
  requests: 5,
  gross: 1.2,
  discount: 0.2,
  net: 1,
  aicGrossAmount: 0.5,
  products: [
    {
      category: 'Copilot',
      label: 'Copilot',
      requests: 5,
      gross: 1.2,
      discount: 0.2,
      net: 1,
      aicQuantity: 50,
      aicGrossAmount: 0.5,
    },
  ],
};

describe('BillingGroupTable', () => {
  it('renders extra columns and shared expandable product billing details', () => {
    render(
      <BillingGroupTable<OrganizationBillingGroupRow>
        title="Organizations"
        singularLabel="organization"
        nameColumnLabel="Organization"
        rows={[billingRow]}
        hasCosts={true}
        hasAicGross={true}
        detailIdPrefix="organization-details"
        extraColumns={[{ header: 'Users', render: (row) => row.users.toLocaleString() }]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Organization' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' })).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Gross' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Discount' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Net' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /test-org-one/i }));

    const details = document.getElementById('organization-details-0');
    expect(details).not.toBeNull();
    const detailsTable = within(details as HTMLElement);
    expect(detailsTable.getByRole('columnheader', { name: 'Product' })).toBeInTheDocument();
    expect(detailsTable.getByText('Copilot')).toBeInTheDocument();
    expect(detailsTable.getByText('$0.50')).toBeInTheDocument();
    expect(detailsTable.getByText('-$0.20')).toBeInTheDocument();
  });

  it('omits org-only and PRU cost columns when they are not requested', () => {
    render(
      <BillingGroupTable
        title="Cost Centers"
        singularLabel="cost center"
        nameColumnLabel="Cost Center"
        rows={[billingRow]}
        hasCosts={false}
        hasAicGross={true}
        detailIdPrefix="cost-center-details"
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Cost Center' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'AI Credits Gross' })).toHaveLength(1);
    expect(screen.queryByRole('columnheader', { name: 'Gross' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Discount' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Net' })).not.toBeInTheDocument();
  });
});
