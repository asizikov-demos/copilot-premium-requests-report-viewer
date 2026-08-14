import { fireEvent, render, screen, within } from '@testing-library/react';

import { DailyConsumptionTable } from '@/components/DailyConsumptionTable';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';

function makeProcessedRow(overrides: Partial<ProcessedData>): ProcessedData {
  const dateKey = overrides.dateKey ?? '2026-08-01';
  const timestamp = new Date(`${dateKey}T00:00:00Z`);

  return {
    timestamp,
    user: 'test-user-one',
    model: 'test-model-one',
    requestsUsed: 0,
    exceedsQuota: false,
    totalQuota: '1000',
    quotaValue: 1000,
    iso: timestamp.toISOString(),
    dateKey,
    monthKey: dateKey.slice(0, 7),
    epoch: timestamp.getTime(),
    usageUnit: 'ai_credit',
    ...overrides,
  };
}

describe('DailyConsumptionTable', () => {
  it('expands a UTC day to show the per-model AI Credits breakdown', () => {
    const sourceRows = [
      makeProcessedRow({
        model: 'test-model-one',
        aicQuantity: 100,
        aicGrossAmount: 100 * PRICING.AI_CREDIT_USD_VALUE,
        netAmount: 0,
      }),
      makeProcessedRow({
        model: 'test-model-two',
        aicQuantity: 50,
        aicGrossAmount: 50 * PRICING.AI_CREDIT_USD_VALUE,
        netAmount: 0.2,
      }),
    ];

    render(
      <DailyConsumptionTable
        data={[{
          date: '2026-08-01',
          totalRequests: 150,
          'test-model-one': 100,
          'test-model-two': 50,
        }]}
        models={['test-model-one', 'test-model-two']}
        isUsageBasedBilling={true}
        sourceRows={sourceRows}
      />
    );

    expect(screen.getByRole('heading', { name: 'Daily Consumption' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Included credits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aug 1, 2026/ })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: /Aug 1, 2026/ }));

    const details = screen.getByRole('table', { name: 'Aug 1, 2026 model consumption' });
    expect(screen.getByRole('button', { name: /Aug 1, 2026/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(details).getByText('test-model-one')).toBeInTheDocument();
    expect(within(details).getByText('test-model-two')).toBeInTheDocument();
    expect(within(details).getByText('$0.20')).toBeInTheDocument();
  });

  it('uses request columns for legacy reports', () => {
    render(
      <DailyConsumptionTable
        data={[{ date: '2026-08-01', totalRequests: 3, 'test-model-one': 3 }]}
        models={['test-model-one']}
        isUsageBasedBilling={false}
        sourceRows={[]}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Requests' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Included credits' })).not.toBeInTheDocument();
    expect(screen.getByText('3.00')).toBeInTheDocument();
  });
});
