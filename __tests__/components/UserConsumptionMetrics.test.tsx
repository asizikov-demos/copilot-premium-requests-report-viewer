import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import { UserConsumptionMetrics } from '@/components/UserConsumptionMetrics';
import { buildProcessedDataFromRawRows } from '@/utils/ingestion/adapters';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children, data }: { children: ReactNode; data: unknown }) => (
    <div data-testid="token-trend" data-chart={JSON.stringify(data)}>{children}</div>
  ),
  Line: () => <div />,
  Legend: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

const base = {
  date: '2026-06-30T23:59:59Z', username: 'test-user-one', model: 'test-model-one',
  quantity: '10', unit_type: 'ai-credits',
};
function chart() {
  return JSON.parse(screen.getByTestId('token-trend').getAttribute('data-chart') ?? '[]');
}

describe('UserConsumptionMetrics', () => {
  it('shows ranked model shares without summary cards or combined token totals', () => {
    render(<UserConsumptionMetrics rows={buildProcessedDataFromRawRows([
      { ...base, input: '1000', output: '0', cache_write: '40', cache_read: '100' },
      { ...base, date: '2026-07-01', model: 'test-model-two', quantity: '30', input: '3000', output: '0', cache_write: '60', cache_read: '300' },
    ])} />);
    expect(screen.queryByText('AI Credits per Active Day')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Days')).not.toBeInTheDocument();
    expect(screen.queryByText('Peak Daily AI Credits')).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Model Consumption Breakdown' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('test-model-two');
    expect(within(rows[0]).getAllByRole('cell').map(cell => cell.textContent)).toEqual([
      '30(75.0%)', `${(3000).toLocaleString()}(75.0%)`, '0', '60(60.0%)', '300(75.0%)',
    ]);
    expect(screen.queryByText(/Total Tokens/)).not.toBeInTheDocument();
  });

  it('filters only the trend, with gaps for missing, partial and unreported dates', () => {
    const rows = buildProcessedDataFromRawRows([
      { ...base, input: '10', output: '0' },
      { ...base, model: 'test-model-two', input: '20', output: '0' },
      { ...base, date: '2026-07-02', input: '5' },
      { ...base, date: '2026-07-02' },
    ]);
    const { rerender } = render(<UserConsumptionMetrics rows={rows} />);
    expect(chart()).toEqual([
      { date: '2026-06-30', inputTokens: 30, outputTokens: 0, cacheReadTokens: null, cacheWriteTokens: null },
      { date: '2026-07-01', inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null },
      { date: '2026-07-02', inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null },
    ]);
    fireEvent.change(screen.getByLabelText('Trend model'), { target: { value: 'test-model-two' } });
    expect(chart()[0].inputTokens).toBe(20);
    expect(chart()[2].inputTokens).toBeNull();
    expect(screen.getByRole('table')).toHaveTextContent('test-model-one');
    rerender(<UserConsumptionMetrics rows={rows.filter(row => row.monthKey === '2026-07')} />);
    expect(screen.getByLabelText('Trend model')).toHaveValue('');
    expect(chart()).toHaveLength(1);
    expect(screen.getByText('No complete daily token counts are available for this selection.')).toBeInTheDocument();
  });

  it('marks partial model totals', () => {
    render(<UserConsumptionMetrics rows={buildProcessedDataFromRawRows([
      { ...base, input: '10' },
      { ...base, unit_type: 'requests', quantity: '1' },
    ])} />);
    expect(within(screen.getByRole('table')).getAllByText('(partial)')).toHaveLength(2);
    expect(within(screen.getByRole('table')).getAllByLabelText('Not reported')).toHaveLength(3);
  });

  it('preserves legacy views and displays zero tokens without credit metrics', () => {
    const { container, rerender } = render(<UserConsumptionMetrics rows={buildProcessedDataFromRawRows([
      { ...base, unit_type: 'requests' },
    ])} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UserConsumptionMetrics rows={buildProcessedDataFromRawRows([
      { ...base, unit_type: 'requests', input: '0' },
    ])} />);
    expect(screen.getByText('Token Usage Over Time')).toBeInTheDocument();
    expect(screen.queryByText('AI Credits per Active Day')).not.toBeInTheDocument();
    expect(chart()[0].inputTokens).toBe(0);
    expect(screen.getByRole('table')).not.toHaveTextContent('NaN');
    expect(screen.getByRole('table')).not.toHaveTextContent('Infinity');
  });

  it('does not bridge unselected months and hides failed tokens while keeping credit metrics', () => {
    const rows = buildProcessedDataFromRawRows([
      { ...base, date: '2026-06-30', input: '1' },
      { ...base, date: '2026-08-01', input: '2' },
    ]);
    const { rerender } = render(<UserConsumptionMetrics rows={rows} />);
    expect(chart()).toHaveLength(33);
    expect(chart()[0]).toMatchObject({ date: '2026-06-30', inputTokens: 1 });
    expect(chart()[32]).toMatchObject({ date: '2026-08-01', inputTokens: 2 });
    expect(chart().slice(1, -1).every((point: { inputTokens: number | null }) => point.inputTokens === null)).toBe(true);
    rerender(<UserConsumptionMetrics rows={rows} tokensAvailable={false} />);
    expect(screen.queryByText('Token Usage Over Time')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Input Tokens' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
  });
});
