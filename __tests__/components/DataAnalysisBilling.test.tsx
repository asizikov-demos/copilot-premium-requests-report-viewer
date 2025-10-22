import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { DataAnalysis } from '@/components/DataAnalysis';
import { newFormatRows } from '../fixtures/newFormatCSVData';

// DataAnalysis expects legacy CSVData[] but processCSVData can now handle both.
// Cast new format rows to any to satisfy prop typing in test context.

// Mock ResizeObserver for Recharts ResponsiveContainer in JSDOM
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('DataAnalysis billing summary (new format)', () => {
  it('renders billing summary when cost fields are present', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<DataAnalysis csvData={newFormatRows as any} filename="new-format.csv" onReset={() => {}} />);

    // Wait for provider effects & rendering.
    await waitFor(() => {
      const billing = screen.getByLabelText('billing-summary');
      expect(billing).toBeInTheDocument();
      expect(billing).toHaveTextContent(/Gross Amount:/i);
      expect(billing).toHaveTextContent(/Net Amount:/i);
    });
  });
});
