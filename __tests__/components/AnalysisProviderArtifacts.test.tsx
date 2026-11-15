import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { DataAnalysis } from '@/components/DataAnalysis';
import { REPORT_AGGREGATOR_IDS } from '@/utils/ingestion/streamFile';

import { ingestRows } from '../helpers/aggregateRows';

// Ensure ResponsiveContainer does not throw in test environment
beforeAll(() => {
  // Typed minimal ResizeObserver stub for JSDOM test environment (no layout measurements required).
  class ResizeObserver {
    observe(_target: Element, _options?: unknown): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
  }
  // Assign to globalThis with a lightweight structural type to avoid 'any' and suppressions.
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserver;
});

describe('AnalysisProvider artifacts', () => {
  it('renders an empty report from registered aggregate outputs alone', () => {
    const ingestionResult = ingestRows([]);
    expect(Object.keys(ingestionResult.outputs).sort()).toEqual([...REPORT_AGGREGATOR_IDS].sort());
    render(<DataAnalysis ingestionResult={ingestionResult} filename="test-empty.csv" onReset={() => {}} />);
    expect(screen.getByText('test-empty.csv')).toBeInTheDocument();
  });

  it.each([
    ['featureUsage', 'Missing or invalid featureUsage output in ingestion result'],
    ['billingPages', 'Missing billingPages output in ingestion result'],
    ['modelDaily', 'Missing modelDaily output in ingestion result'],
    ['detailPages', 'Missing detailPages output in ingestion result'],
  ])('throws a clear error when %s artifacts are missing', (id, message) => {
    const ingestionResult = ingestRows([]);
    delete ingestionResult.outputs[id];
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<DataAnalysis ingestionResult={ingestionResult} filename="no-feature.csv" onReset={() => {}} />))
      .toThrow(message);

    consoleError.mockRestore();
  });
});
