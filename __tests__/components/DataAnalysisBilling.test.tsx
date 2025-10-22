import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { DataAnalysis } from '@/components/DataAnalysis';
import { newFormatRows } from '../fixtures/newFormatCSVData';

// Mock ResizeObserver for Recharts ResponsiveContainer in JSDOM
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('DataAnalysis billing summary', () => {
  it('renders billing summary when cost fields are present', async () => {
    render(<DataAnalysis csvData={newFormatRows} filename="billing-export.csv" onReset={() => {}} />);

    // Wait for provider effects & rendering.
    await waitFor(() => {
      const billing = screen.getByLabelText('billing-summary');
      expect(billing).toBeInTheDocument();
      expect(billing).toHaveTextContent(/Gross Amount:/i);
      expect(billing).toHaveTextContent(/Net Amount:/i);
    });
  });
});
