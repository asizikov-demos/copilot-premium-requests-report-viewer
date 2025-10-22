import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { DataAnalysis } from '@/components/DataAnalysis';
import { newFormatRows } from '../fixtures/newFormatCSVData';
import type { IngestionResult } from '@/utils/ingestion';

// Mock ResizeObserver for Recharts ResponsiveContainer in JSDOM
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Helper to create mock IngestionResult
function createMockIngestionResult(rows: unknown[]): IngestionResult {
  return {
    outputs: {
      'quota': { quotaByUser: new Map(), conflicts: new Map(), distinctQuotas: new Set(), hasMixedQuotas: false, hasMixedLicenses: false },
      'usage': { userTotals: new Map(), modelBreakdown: new Map(), globalModelTotals: new Map(), topModelPerUser: new Map() },
      'dailyBuckets': { dailyUserTotals: new Map(), startDate: new Date(), endDate: new Date() },
      'rawData': rows
    },
    rowsProcessed: rows.length,
    durationMs: 100,
    warnings: []
  };
}

describe('DataAnalysis billing summary', () => {
  it('renders billing summary when cost fields are present', async () => {
    const ingestionResult = createMockIngestionResult(newFormatRows);
    render(<DataAnalysis ingestionResult={ingestionResult} filename="billing-export.csv" onReset={() => {}} />);

    // Wait for provider effects & rendering. Billing summary may appear once processedData is built.
    await waitFor(() => {
      const billing = screen.getByLabelText('billing-summary');
      expect(billing).toBeInTheDocument();
      expect(billing).toHaveTextContent(/Gross Amount:/i);
      expect(billing).toHaveTextContent(/Net Amount:/i);
    });
  });
});
