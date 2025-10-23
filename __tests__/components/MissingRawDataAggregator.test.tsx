import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { DataAnalysis } from '@/components/DataAnalysis';
import type { IngestionResult } from '@/utils/ingestion';

// Ensure ResponsiveContainer does not throw in test environment
beforeAll(() => {
  // @ts-expect-error Minimal stub for JSDOM environment
  global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
});

function createIngestionResultWithoutRawData(): IngestionResult {
  return {
    outputs: {
      quota: { quotaByUser: new Map(), conflicts: new Map(), distinctQuotas: new Set(), hasMixedQuotas: false, hasMixedLicenses: false },
      usage: { users: [], modelTotals: {}, userCount: 0, modelCount: 0 },
      dailyBuckets: { dailyUserTotals: new Map(), dateRange: null, months: [] }
      // Intentionally no rawData aggregator output
    },
    rowsProcessed: 0,
    durationMs: 0,
    warnings: []
  };
}

describe('AnalysisProvider without rawData aggregator', () => {
  it('renders without crashing and handles missing rawData gracefully', () => {
    const ingestionResult = createIngestionResultWithoutRawData();
    render(<DataAnalysis ingestionResult={ingestionResult} filename="no-raw.csv" onReset={() => {}} />);
    // Header should render
    expect(screen.getByText('Data Analysis Results')).toBeInTheDocument();
  });
});
