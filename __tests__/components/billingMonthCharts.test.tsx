import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';
import type { ContextType, ReactElement } from 'react';
import ts from 'typescript';

import { BillingGroupDetailsView } from '@/components/BillingGroupDetailsView';
import { UserConsumptionMetrics } from '@/components/UserConsumptionMetrics';
import { UserDetailsView } from '@/components/UserDetailsView';
import { CodingAgentUsageChart } from '@/components/charts/CodingAgentUsageChart';
import { DailyConsumptionChart } from '@/components/charts/DailyConsumptionChart';
import { ModelDailyStackedChart } from '@/components/charts/ModelDailyStackedChart';
import { UsersConsumptionHeatmap } from '@/components/charts/UsersConsumptionHeatmap';
import { AnalysisContext } from '@/context/AnalysisContext';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { aggregateDailyConsumption } from '@/utils/dailyConsumption';
import {
  buildDailyBucketsArtifactsFromProcessedData,
  buildDailyCodeReviewUsageFromArtifacts,
  buildDailyCodingAgentUsageFromArtifacts,
  buildDailyCumulativeDataFromArtifacts,
  buildDailyModelUsageFromArtifacts,
  buildUsageArtifactsFromProcessedData,
} from '@/utils/ingestion';

import { makeProcessedData } from '../helpers/testUtils';

jest.mock('recharts', () => {
  const Chart = ({ data }: { data: unknown }) => <div data-testid="date-chart">{JSON.stringify(data)}</div>;
  return {
    ResponsiveContainer: ({ children }: { children: ReactElement }) => children,
    BarChart: Chart, LineChart: Chart, ComposedChart: Chart,
    Bar: () => null, Line: () => null, XAxis: () => null, YAxis: () => null,
    CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
  };
});

const userRows = [
  makeProcessedData({
    timestamp: new Date('2024-02-20T23:59:59Z'), model: 'Code Review model',
    creditsUsed: 3, inputTokens: 10, netAmount: 0.3,
  }),
  makeProcessedData({
    timestamp: new Date('2024-02-10T00:00:00Z'), model: 'Coding Agent model',
    creditsUsed: 2, inputTokens: 0, netAmount: 0.2,
  }),
];
const periodRows = [
  ...userRows,
  makeProcessedData({ timestamp: new Date('2024-04-15T00:00:00Z'), user: 'test-user-two' }),
];
const daily = buildDailyBucketsArtifactsFromProcessedData(periodRows);
const usage = buildUsageArtifactsFromProcessedData(periodRows);
const userDetailsContext = {
  dailyBucketsArtifacts: daily,
  usageArtifacts: usage,
} as ContextType<typeof AnalysisContext>;
const dates = [
  ...Array.from({ length: 29 }, (_, index) => `2024-02-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 30 }, (_, index) => `2024-04-${String(index + 1).padStart(2, '0')}`),
];

// Keep this registry exhaustive: discovery below fails when a new date chart is
// added without a full-month contract, rather than silently skipping coverage.
const contracts: { file: string; name: string; render: () => ReactElement }[] = [
  {
    file: 'charts/DailyConsumptionChart.tsx', name: 'USD',
    render: () => <DailyConsumptionChart data={aggregateDailyConsumption(userRows, periodRows)} />,
  },
  {
    file: 'charts/CodingAgentUsageChart.tsx', name: 'cloud agent',
    render: () => <CodingAgentUsageChart data={buildDailyCodingAgentUsageFromArtifacts(daily)} />,
  },
  {
    file: 'charts/CodingAgentUsageChart.tsx', name: 'code review',
    render: () => <CodingAgentUsageChart data={buildDailyCodeReviewUsageFromArtifacts(daily)} />,
  },
  {
    file: 'charts/ModelDailyStackedChart.tsx', name: 'model trends',
    render: () => <ModelDailyStackedChart data={buildDailyModelUsageFromArtifacts(daily, usage)}
      models={Object.keys(usage.modelTotals)} modelColors={{}} />,
  },
  {
    file: 'charts/UserDailyStackedChart.tsx', name: 'user detail artifact chart and token trend',
    render: () => (
      <AnalysisContext.Provider value={userDetailsContext}>
        <UserDetailsView user="test-user-one" processedData={periodRows}
          userQuotaValue="unknown" onBack={jest.fn()} />
      </AnalysisContext.Provider>
    ),
  },
  {
    file: 'UserConsumptionMetrics.tsx', name: 'tokens with report-wide scope',
    render: () => <UserConsumptionMetrics rows={userRows} periodRows={periodRows} />,
  },
  ...['organization', 'cost center'].map(groupLabel => ({
    file: 'charts/ModelDailyStackedChart.tsx', name: `${groupLabel} detail`,
    render: () => <BillingGroupDetailsView groupName="test-group-one" groupLabel={groupLabel}
      groupsLabel={`${groupLabel}s`} detailIdPrefix="test-group" rows={userRows} periodRows={periodRows}
      quantityColumnLabel="AI Credits" costLabels={getBillingCostLabels()} hasAicGross={false} onBack={jest.fn()} />,
  })),
];

describe('billingMonth chart contracts', () => {
  it.each(contracts)('$name renders all days of the report months, not just active dates', ({ render: element }) => {
    render(element());
    for (const chart of screen.getAllByTestId('date-chart')) {
      const points: { date: string }[] = JSON.parse(chart.textContent ?? '[]');
      expect(points.map(point => point.date)).toEqual(dates);
    }
  });

  it('keeps token absence null, reported zero intact, and report-only months visible', () => {
    const { rerender } = render(<UserConsumptionMetrics rows={userRows} periodRows={periodRows} />);
    const points = JSON.parse(screen.getByTestId('date-chart').textContent ?? '[]');
    expect(points[0].inputTokens).toBeNull();
    expect(points[9].inputTokens).toBe(0);
    expect(points[19].inputTokens).toBe(10);
    expect(points[58].inputTokens).toBeNull();
    rerender(<UserConsumptionMetrics rows={userRows} periodRows={periodRows.filter(row => row.monthKey === '2024-02')} />);
    expect(JSON.parse(screen.getByTestId('date-chart').textContent ?? '[]')).toHaveLength(29);
  });

  it('renders the SVG heatmap through the final day of every selected month', () => {
    render(<UsersConsumptionHeatmap dailyCumulativeData={buildDailyCumulativeDataFromArtifacts(daily)}
      users={['test-user-one']} />);
    const heatmap = screen.getByRole('img');
    expect(heatmap).toHaveTextContent('2/1');
    expect(heatmap).toHaveTextContent('4/30');
    const columnDates = [...new Set(
      [...heatmap.querySelectorAll('g > title')].map(title => title.textContent?.split(':')[0])
    )];
    expect(columnDates).toEqual(dates.map(date => {
      const [, month, day] = date.split('-');
      return `${Number(month)}/${Number(day)}`;
    }));
  });

  it('requires a contract for every date-axis chart in the component tree', () => {
    const root = path.join(process.cwd(), 'src/components');
    function findDateCharts(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return findDateCharts(file);
        if (!file.endsWith('.tsx')) return [];
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const axisNames = new Set<string>();
        for (const statement of source.statements) {
          if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
            || statement.moduleSpecifier.text !== 'recharts') continue;
          const bindings = statement.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings)) {
            for (const item of bindings.elements) {
              if ((item.propertyName ?? item.name).text === 'XAxis') axisNames.add(item.name.text);
            }
          }
        }
        let dateAxis = false;
        function visit(node: ts.Node) {
          if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
            const tag = node.tagName.getText(source);
            if (axisNames.has(tag) || (tag === 'svg' && source.text.includes('utcDateTickFormatter'))) {
              dateAxis = true;
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
        return dateAxis ? [path.relative(root, file)] : [];
      });
    }
    expect(findDateCharts(root).sort()).toEqual(
      [...new Set([...contracts.map(contract => contract.file), 'charts/UsersConsumptionHeatmap.tsx'])].sort()
    );
  });
});
