import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { TokenUsageOverview } from '@/components/TokenUsageOverview';
import type { TokenBreakdown, TokenUsageArtifacts } from '@/utils/ingestion';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="token-types-chart">{children}</div>,
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown }) => (
    <div data-testid="daily-token-chart">
      <output data-testid="daily-token-chart-data">{JSON.stringify(data)}</output>
      {children}
    </div>
  ),
  Bar: ({ name }: { name: string }) => <span data-testid="token-bar-series">{name}</span>,
  Line: ({ name }: { name: string }) => <span data-testid="token-line-series">{name}</span>,
  XAxis: () => <span />,
  YAxis: () => <span />,
  CartesianGrid: () => <span />,
  Tooltip: () => <span />,
  Legend: () => <span />,
}));

function createTokenUsageArtifacts(): TokenUsageArtifacts {
  return {
    overall: {
      inputTokens: 0,
      outputTokens: 5,
      cacheWriteTokens: 10,
    },
    byModel: new Map([
      ['test-model-beta', { cacheReadTokens: 7 }],
      ['test-model-alpha', { inputTokens: 0, outputTokens: 5, cacheWriteTokens: 10 }],
      ['test-model-gamma', { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }],
    ]),
    byUser: new Map(),
    byDayAndModel: new Map<string, Map<string, TokenBreakdown>>([
      ['2026-03-01', new Map([
        ['test-model-alpha', { inputTokens: 0, outputTokens: 5 }],
        ['test-model-beta', { cacheReadTokens: 3 }],
      ])],
      ['2026-03-02', new Map([
        ['test-model-alpha', { cacheWriteTokens: 10 }],
        ['test-model-beta', { cacheReadTokens: 4 }],
      ])],
    ]),
    tokenRowCount: 3,
    hasTokenData: true,
  };
}

describe('TokenUsageOverview', () => {
  it('renders token totals, shares, and models ordered by total tokens', () => {
    render(<TokenUsageOverview tokenUsageArtifacts={createTokenUsageArtifacts()} />);

    const summary = screen.getByRole('heading', { name: 'Token summary' }).parentElement?.parentElement;
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText('Total tokens')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('Input tokens')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('Output tokens')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('Cache-read tokens')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('Cache-write tokens')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('N/A')).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText('15')).toBeInTheDocument();
    const totalCard = within(summary as HTMLElement).getByText('Total tokens').parentElement;
    const outputCard = within(summary as HTMLElement).getByText('Output tokens').parentElement;
    expect(totalCard).not.toBeNull();
    expect(outputCard).not.toBeNull();
    expect(within(totalCard as HTMLElement).queryByText(/\d+\.\d+\s*%/)).not.toBeInTheDocument();
    expect(within(outputCard as HTMLElement).getByText('5')).toHaveClass('text-2xl', 'font-semibold', 'text-[#1f2328]');
    expect(within(outputCard as HTMLElement).getByText(/\(33\.3\s%\)/)).toHaveClass('text-xs', 'text-[#636c76]');

    const table = screen.getByRole('table', { name: 'Per-model token breakdown' });
    expect(within(table).getAllByRole('columnheader', { name: 'Total tokens' })).toHaveLength(1);
    expect(within(table).getAllByText('Count; share in brackets')).toHaveLength(4);

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('test-model-alpha');
    expect(rows[1]).toHaveTextContent('15');
    expect(rows[1]).toHaveTextContent('0');
    expect(rows[1]).toHaveTextContent('N/A');
    expect(within(rows[1]).getByText('5')).toHaveClass('font-semibold', 'text-[#1f2328]');
    expect(within(rows[1]).getByText(/\(33\.3\s%\)/)).toHaveClass('text-xs', 'text-[#636c76]');
    expect(within(rows[1]).getByText(/\(66\.7\s%\)/)).toHaveClass('text-xs', 'text-[#636c76]');
    expect(rows[2]).toHaveTextContent('test-model-beta');
    expect(rows[2]).toHaveTextContent('7');
    expect(rows[2]).toHaveTextContent('7');
    expect(rows[3]).toHaveTextContent('test-model-gamma');
    expect(rows[3]).toHaveTextContent('0');
    expect(rows[3]).not.toHaveTextContent('NaN');
    expect(within(rows[3]).queryByText(/\d+\.\d+\s*%/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Token split by model' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Each bar shows how that model/)).not.toBeInTheDocument();
  });

  it('omits summary card shares when the overall total is zero or a field is unavailable', () => {
    const tokenUsageArtifacts = createTokenUsageArtifacts();
    tokenUsageArtifacts.overall = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
    };

    render(<TokenUsageOverview tokenUsageArtifacts={tokenUsageArtifacts} />);

    const summary = screen.getByRole('heading', { name: 'Token summary' }).parentElement?.parentElement;
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getAllByText('0')).toHaveLength(4);
    expect(within(summary as HTMLElement).getByText('N/A')).toBeInTheDocument();

    for (const label of ['Input tokens', 'Output tokens', 'Cache-read tokens', 'Cache-write tokens']) {
      const card = within(summary as HTMLElement).getByText(label).parentElement;
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).queryByText(/\d+\.\d+\s*%/)).not.toBeInTheDocument();
    }
  });

  it('uses the visible, local model selector to narrow only the UTC daily chart', () => {
    render(<TokenUsageOverview tokenUsageArtifacts={createTokenUsageArtifacts()} />);

    const selector = screen.getByLabelText('Model');
    expect(selector).toHaveValue('all');
    expect(within(selector).getByRole('option', { name: 'All models' })).toBeInTheDocument();
    expect(within(selector).getByRole('option', { name: 'test-model-alpha' })).toBeInTheDocument();
    expect(within(selector).getByRole('option', { name: 'test-model-beta' })).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: 'test-model-beta' } });

    const dailyData = screen.getByTestId('daily-token-chart-data');
    expect(dailyData).toHaveTextContent('"date":"2026-03-01"');
    expect(dailyData).toHaveTextContent('"cacheReadTokens":3');
    expect(dailyData).not.toHaveTextContent('"outputTokens":5');
    expect(screen.getByRole('table', { name: 'Per-model token breakdown' })).toBeInTheDocument();
  });

  it('renders the legacy empty note when source token fields are absent', () => {
    render(
      <TokenUsageOverview
        tokenUsageArtifacts={{
          overall: {},
          byModel: new Map(),
          byUser: new Map(),
          byDayAndModel: new Map(),
          tokenRowCount: 0,
          hasTokenData: false,
        }}
      />
    );

    expect(screen.getByText('Token details are not included in this report.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Per-model token breakdown' })).not.toBeInTheDocument();
  });

  it('keeps token views available without billing artifacts', () => {
    render(<TokenUsageOverview tokenUsageArtifacts={createTokenUsageArtifacts()} />);

    const table = screen.getByRole('table', { name: 'Per-model token breakdown' });
    expect(within(table).getByRole('columnheader', { name: 'Total tokens' })).toBeInTheDocument();
    expect(within(table).getByText('test-model-alpha')).toBeInTheDocument();
  });
});
