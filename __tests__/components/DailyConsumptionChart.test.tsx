import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import { DailyConsumptionChart } from '@/components/charts/DailyConsumptionChart';

jest.mock('recharts', () => {
  const actual = jest.requireActual<typeof import('recharts')>('recharts');
  const { cloneElement } = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
      cloneElement(children, { width: 800, height: 400 }),
  };
});

describe('DailyConsumptionChart', () => {
  it('renders green included usage below red additional usage with USD axes and a legend', async () => {
    const { container } = render(
      <DailyConsumptionChart data={[{ date: '2026-06-30', included: 2, additional: 1 }]} />
    );

    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('Included usage')).toBeInTheDocument();
    expect(screen.getByText('Additional usage')).toBeInTheDocument();
    expect(screen.getByText('6/30')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect([...container.querySelectorAll('.recharts-legend-item-text')].map((item) => item.textContent))
      .toEqual(['Included usage', 'Additional usage']);

    await waitFor(() => {
      const series = container.querySelectorAll('.recharts-bar');
      expect(series).toHaveLength(2);
      const included = series[0].querySelector('.recharts-rectangle');
      const additional = series[1].querySelector('.recharts-rectangle');
      expect(included).toHaveAttribute('fill', '#2da44e');
      expect(additional).toHaveAttribute('fill', '#cf222e');
      expect(Number(additional?.getAttribute('y'))).toBeLessThan(Number(included?.getAttribute('y')));
      expect(Number(additional?.getAttribute('y')) + Number(additional?.getAttribute('height')))
        .toBeCloseTo(Number(included?.getAttribute('y')));
    });
  });
});
