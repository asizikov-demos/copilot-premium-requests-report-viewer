import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { DataAnalysis } from '@/components/DataAnalysis';
import type { IngestionResult } from '@/utils/ingestion';

// Ensure ResponsiveContainer does not throw in test environment
beforeAll(() => {
  // Typed minimal ResizeObserver stub for JSDOM test environment (no layout measurements required).
  class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    observe(_target: Element, _options?: unknown): void {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unobserve(_target: Element): void {}
    disconnect(): void {}
  }
  // Assign to globalThis with a lightweight structural type to avoid 'any' and suppressions.
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserver;
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
