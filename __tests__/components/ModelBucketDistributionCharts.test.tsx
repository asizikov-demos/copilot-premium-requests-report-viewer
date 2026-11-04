import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';

import { ModelBucketDistributionCharts } from '@/components/charts/ModelBucketDistributionCharts';
import { PRICING } from '@/constants/pricing';
import { formatCurrency } from '@/utils/formatters';
import { getModelColor } from '@/utils/modelColors';

jest.mock('recharts', () => {
  const actual = jest.requireActual<typeof import('recharts')>('recharts');
  const { cloneElement } = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
      cloneElement(children, { width: 240, height: 192 }),
  };
});

describe('ModelBucketDistributionCharts', () => {
  it('includes case-insensitive bucket prefixes and names every populated chart', () => {
    render(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'auto: Claude Sonnet 5', creditsUsed: 2 },
      { user: 'test-user-two', model: 'AUTO: Claude Sonnet 5', creditsUsed: 3 },
      { user: 'test-user-one', model: 'fusion (standard): test-model-one', creditsUsed: 1 },
      { user: 'test-user-one', model: 'FUSION (HIGH): test-model-one', creditsUsed: 1 },
      { user: 'test-user-one', model: 'Fusion (Max): test-model-one', creditsUsed: 1 },
    ]} />);
    const auto = within(screen.getByRole('region', { name: 'Auto model distribution' }));
    expect(auto.getByText('5.00')).toBeInTheDocument();
    expect(auto.getByText('2 unique users')).toBeInTheDocument();
    expect(auto.getAllByRole('listitem')).toHaveLength(1);
    expect(auto.getByRole('listitem')).toHaveTextContent('Claude Sonnet 5');
    for (const bucket of ['Auto', 'Fusion (Standard)', 'Fusion (High)', 'Fusion (Max)']) {
      expect(screen.getByRole('application', { name: `${bucket} model AI Credits distribution` })).toHaveAttribute('tabindex', '0');
    }
  });

  it('shows model, gross USD cost, and credit share above the ring in its tooltip', async () => {
    const { container } = render(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'Auto: test-model-one', creditsUsed: 300, aicGrossAmount: 2 },
      { user: 'test-user-one', model: 'Auto: test-model-two', creditsUsed: 100, aicGrossAmount: 1 },
    ]} />);
    fireEvent.mouseEnter(container.querySelector('.recharts-pie-sector')!);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('test-model-one');
      expect(screen.getByRole('status')).toHaveTextContent('$2.00 gross cost (USD)');
      expect(screen.getByRole('status')).toHaveTextContent('75.0% of AI Credits');
    });
    expect(container.querySelector('.recharts-tooltip-wrapper')).toHaveStyle({ zIndex: 20 });
    expect(screen.getByRole('status').querySelectorAll('p')).toHaveLength(3);
  });

  it('aggregates credits within the four exact prefix buckets and trims model names', () => {
    render(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'Auto: Claude Sonnet 5', creditsUsed: 1.25 },
      { user: 'test-user-one', model: 'Auto:  Claude Sonnet 5 ', creditsUsed: 1.75 },
      { user: 'test-user-one', model: 'Auto: GPT-6 Luna', creditsUsed: 1 },
      { user: 'test-user-one', model: 'Fusion (Standard): Claude Sonnet 5', creditsUsed: 5 },
      { user: 'test-user-one', model: 'Fusion (High): Claude Sonnet 5', creditsUsed: 6 },
      { user: 'test-user-one', model: 'Fusion (Max): Claude Sonnet 5', creditsUsed: 7 },
      { user: 'test-user-one', model: 'Claude Sonnet 5', creditsUsed: 100 },
      { user: 'test-user-one', model: 'Fusion (Ultra): Claude Sonnet 5', creditsUsed: 100 },
      { user: 'test-user-one', model: 'Not Auto: Claude Sonnet 5', creditsUsed: 100 },
      { user: 'test-user-one', model: 'Auto: test-model-zero', creditsUsed: 0 },
    ]} />);

    expect(screen.getAllByRole('region')).toHaveLength(4);
    const auto = within(screen.getByRole('region', { name: 'Auto model distribution' }));
    expect(auto.getByText('4.00')).toBeInTheDocument();
    const entries = auto.getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent(`Claude Sonnet 5${formatCurrency(3 * PRICING.AI_CREDIT_USD_VALUE)}75.0%`);
    expect(entries[1]).toHaveTextContent(`GPT-6 Luna${formatCurrency(PRICING.AI_CREDIT_USD_VALUE)}25.0%`);
    expect(auto.queryByText('test-model-zero')).not.toBeInTheDocument();
    for (const [bucket, credits] of [['Standard', '5.00'], ['High', '6.00'], ['Max', '7.00']]) {
      const fusion = within(screen.getByRole('region', { name: `Fusion (${bucket}) model distribution` }));
      expect(fusion.getAllByRole('listitem')).toHaveLength(1);
      expect(fusion.getByRole('listitem')).toHaveTextContent(`Claude Sonnet 5${formatCurrency(Number(credits) * PRICING.AI_CREDIT_USD_VALUE)}100.0%`);
    }
    expect(screen.queryByText('Auto: Claude Sonnet 5')).not.toBeInTheDocument();
  });

  it('renders proportional ring sectors with consistent colors for the underlying model', () => {
    const { container } = render(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'Auto: Claude Sonnet 5', creditsUsed: 3 },
      { user: 'test-user-one', model: 'Auto: GPT-6 Luna', creditsUsed: 1 },
      { user: 'test-user-one', model: 'Fusion (High): Claude Sonnet 5', creditsUsed: 2 },
    ]} />);
    const sectors = container.querySelectorAll('.recharts-pie-sector path');
    expect(sectors).toHaveLength(3);
    expect(sectors[0]).toHaveAttribute('fill', getModelColor('Claude Sonnet 5'));
    expect(sectors[1]).toHaveAttribute('fill', getModelColor('GPT-6 Luna'));
    expect(sectors[2]).toHaveAttribute('fill', getModelColor('Claude Sonnet 5'));
    expect(sectors[0].getAttribute('d')).not.toBe(sectors[1].getAttribute('d'));
  });

  it('shows empty buckets and updates totals and models when filtered rows change', () => {
    const { rerender } = render(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'Auto: test-model-one', creditsUsed: 0.125 },
    ]} />);
    expect(screen.getAllByRole('heading', { name: 'No model usage' })).toHaveLength(3);
    expect(screen.getByRole('listitem')).toHaveTextContent(`test-model-one${formatCurrency(0.125 * PRICING.AI_CREDIT_USD_VALUE)}100.0%`);
    rerender(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'Fusion (Max): test-model-two', creditsUsed: 9.5 },
    ]} />);
    expect(screen.queryByText('test-model-one')).not.toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent(`test-model-two${formatCurrency(9.5 * PRICING.AI_CREDIT_USD_VALUE)}100.0%`);
    rerender(<ModelBucketDistributionCharts rows={[]} />);
    expect(screen.getAllByRole('heading', { name: 'No model usage' })).toHaveLength(4);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('No Auto usage was reported for the selected billing period.')).toBeInTheDocument();
    for (const card of screen.getAllByRole('region')) {
      expect(card).toHaveClass('h-[28rem]', 'flex', 'flex-col');
      expect(card.querySelector('[data-component="Blankslate"]')?.parentElement?.parentElement).toHaveClass('grid', 'flex-1');
    }
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps card dimensions fixed and enables legend scrolling only after disclosure', async () => {
    const user = userEvent.setup();
    render(<ModelBucketDistributionCharts rows={Array.from({ length: 20 }, (_, index) => ({
      user: 'test-user-one',
      model: `Auto: test-model-with-a-long-name-${index}`,
      creditsUsed: 1000000,
    }))} />);
    const list = screen.getByRole('list', { name: 'Auto model gross cost (USD) and AI Credits share' });
    expect(list).not.toHaveClass('max-h-40', 'overflow-y-auto');
    expect(list).not.toHaveAttribute('tabindex');
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(5);
    for (const entry of entries) {
      expect(entry).toHaveClass('grid', 'grid-cols-[minmax(0,1fr)_max-content_3rem]', 'items-center');
      expect(within(entry).getByText(formatCurrency(1000000 * PRICING.AI_CREDIT_USD_VALUE))).toHaveClass('whitespace-nowrap');
      expect(within(entry).getByText('5.0%')).toHaveClass('whitespace-nowrap');
    }
    expect(screen.getByText('test-model-with-a-long-name-0')).toHaveClass('truncate');
    expect(screen.getByText('test-model-with-a-long-name-0')).toHaveAttribute('title', 'test-model-with-a-long-name-0');
    const toggle = screen.getByRole('button', { name: 'Show all 20 models' });
    const card = screen.getByRole('region', { name: 'Auto model distribution' });
    const cardClasses = card.className;
    expect(card).toHaveClass('h-[28rem]');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', list.id);
    expect(document.querySelectorAll('.recharts-pie-sector path')).toHaveLength(20);
    await user.click(toggle);
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Show fewer models');
    expect(list).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1');
    expect(list).toHaveAttribute('tabindex', '0');
    expect(card.className).toBe(cardClasses);
    await user.click(toggle);
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(list).not.toHaveClass('overflow-y-auto');
    expect(card.className).toBe(cardClasses);
    expect(toggle).toHaveFocus();
  });

  it('uses reported gross USD amounts, preserves explicit zero, and leaves rings in credits', () => {
    render(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'Auto: test-model-one', creditsUsed: 300, aicGrossAmount: 2 },
      { user: 'test-user-one', model: 'Auto: test-model-one', creditsUsed: 100, aicGrossAmount: 0.5 },
      { user: 'test-user-one', model: 'Auto: test-model-two', creditsUsed: 100, aicGrossAmount: 0 },
    ]} />);
    const auto = within(screen.getByRole('region', { name: 'Auto model distribution' }));
    expect(auto.getByText('500.00')).toBeInTheDocument();
    expect(auto.getAllByRole('listitem')[0]).toHaveTextContent('test-model-one$2.5080.0%');
    expect(auto.getAllByRole('listitem')[1]).toHaveTextContent('test-model-two$0.0020.0%');
  });

  it('counts unique attributed users per bucket and updates with the selected rows', () => {
    const { rerender } = render(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-one', model: 'Auto: test-model-one', creditsUsed: 2 },
      { user: 'test-user-one', model: 'Auto: test-model-two', creditsUsed: 3 },
      { user: 'test-user-two', model: 'Auto: test-model-one', creditsUsed: 1 },
      { user: '', model: 'Auto: test-model-one', creditsUsed: 5 },
      { user: ' ', model: 'Auto: test-model-one', creditsUsed: 5 },
      { user: 'test-user-three', model: 'Auto: test-model-one', creditsUsed: 5, isUnattributedUsage: true },
      { user: 'test-user-one', model: 'Fusion (High): test-model-one', creditsUsed: 2 },
    ]} />);
    expect(within(screen.getByRole('region', { name: 'Auto model distribution' })).getByText('2 unique users')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Fusion (High) model distribution' })).getByText('1 unique user')).toBeInTheDocument();
    expect(screen.getAllByText('0 unique users')).toHaveLength(2);
    expect(screen.queryByText(/Legend: gross cost/)).not.toBeInTheDocument();

    rerender(<ModelBucketDistributionCharts rows={[
      { user: 'test-user-two', model: 'Auto: test-model-one', creditsUsed: 1 },
    ]} />);
    expect(within(screen.getByRole('region', { name: 'Auto model distribution' })).getByText('1 unique user')).toBeInTheDocument();
    expect(screen.getAllByText('0 unique users')).toHaveLength(3);
  });
});
