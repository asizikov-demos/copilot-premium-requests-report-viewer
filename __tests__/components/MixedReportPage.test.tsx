import { fireEvent, render, screen } from '@testing-library/react';

import Home from '@/app/page';
import { PrimerProviders } from '@/app/providers';
import type { IngestionResult } from '@/utils/ingestion';

jest.mock('@/components/CSVUploader', () => ({
  CSVUploader: ({
    onDataLoad,
    onError,
    error,
  }: {
    onDataLoad: (result: IngestionResult, filename: string) => void;
    onError: (message: string) => void;
    error?: string;
  }) => (
    <div>
      <button onClick={() => onDataLoad({
        outputs: {},
        rowsProcessed: 2,
        durationMs: 0,
        warnings: [],
      }, 'test-mixed-report.csv')}>
        Load mixed report
      </button>
      <button onClick={() => onError('Invalid CSV')}>Load invalid report</button>
      {error && <p role="alert">{error}</p>}
    </div>
  ),
}));

jest.mock('@/components/DataAnalysis', () => ({
  DataAnalysis: () => <div>AI-credit analysis</div>,
}));

describe('mixed billing export', () => {
  it('passes processing errors into the upload screen', () => {
    render(<PrimerProviders><Home /></PrimerProviders>);

    fireEvent.click(screen.getByRole('button', { name: 'Load invalid report' }));
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Invalid CSV');
  });

  it('shows the AI-credit analysis without a skipped-requests notice', () => {
    render(<PrimerProviders><Home /></PrimerProviders>);

    fireEvent.click(screen.getByRole('button', { name: 'Load mixed report' }));
    expect(screen.getByText('AI-credit analysis')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Report' }));
    expect(screen.getByRole('button', { name: 'Load mixed report' })).toBeInTheDocument();
  });

  it('keeps the theme toggle and loaded report state when switching themes or resetting', () => {
    localStorage.clear();
    render(<PrimerProviders><Home /></PrimerProviders>);
    const toggle = screen.getByRole('button', { name: 'Light / GitHub Dimmed theme' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Dimmed');
    expect(document.documentElement).toHaveAttribute('data-color-mode', 'dark');

    fireEvent.click(screen.getByRole('button', { name: 'Load mixed report' }));
    fireEvent.click(toggle);
    expect(screen.getByText('AI-credit analysis')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'New Report' }));
    expect(screen.getByRole('button', { name: 'Load mixed report' })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('copilot-billing-theme')).toBe('dimmed');
    localStorage.clear();
  });
});
