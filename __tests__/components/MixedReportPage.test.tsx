import { fireEvent, render, screen } from '@testing-library/react';

import Home from '@/app/page';
import type { IngestionResult } from '@/utils/ingestion';

jest.mock('@/components/CSVUploader', () => ({
  CSVUploader: ({
    onDataLoad,
  }: {
    onDataLoad: (result: IngestionResult, filename: string) => void;
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
    </div>
  ),
}));

jest.mock('@/components/DataAnalysis', () => ({
  DataAnalysis: () => <div>AI-credit analysis</div>,
}));

describe('mixed billing export', () => {
  it('shows the AI-credit analysis without a skipped-requests notice', () => {
    render(<Home />);

    fireEvent.click(screen.getByRole('button', { name: 'Load mixed report' }));
    expect(screen.getByText('AI-credit analysis')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Report' }));
    expect(screen.getByRole('button', { name: 'Load mixed report' })).toBeInTheDocument();
  });
});
