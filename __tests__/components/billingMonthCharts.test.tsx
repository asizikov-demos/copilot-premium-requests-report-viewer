import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import ts from 'typescript';

import { BillingGroupDetailsView, UserConsumptionMetrics, UserDetailsView } from '../helpers/detailFixtures';
import { CodingAgentUsageChart } from '@/components/charts/CodingAgentUsageChart';
import { DailyConsumptionChart } from '@/components/charts/DailyConsumptionChart';
import { ModelDailyStackedChart } from '@/components/charts/ModelDailyStackedChart';
import { UsersConsumptionHeatmap } from '@/components/charts/UsersConsumptionHeatmap';
import { AnalysisProvider } from '@/context/AnalysisContext';
import { getBillingCostLabels } from '@/utils/billingLabels';
import { aggregateDailyConsumption } from '@/utils/dailyConsumption';
import {
  buildDailyCodeReviewUsageFromArtifacts,
  buildDailyCodingAgentUsageFromArtifacts,
  buildDailyCumulativeDataFromArtifacts,
  buildDailyModelUsageFromArtifacts,
} from '@/utils/ingestion';

import { makeUsageRow } from '../helpers/makeNormalizedRow';
import { buildDailyBucketsArtifactsFromRows, buildUsageArtifactsFromRows } from '../helpers/normalizedArtifacts';
import { makeModelDailyArtifacts } from '../helpers/modelDailyArtifacts';
import { ingestRows } from '../helpers/aggregateRows';

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
  makeUsageRow({
    day: '2024-02-20T23:59:59Z'.slice(0, 10), model: 'Code Review model',
    quantity: 3, inputTokens: 10, netAmount: 0.3,
  }),
  makeUsageRow({
    day: '2024-02-10T00:00:00Z'.slice(0, 10), model: 'Coding Agent model',
    quantity: 2, inputTokens: 0, netAmount: 0.2,
  }),
];
const periodRows = [
  ...userRows,
  makeUsageRow({ day: '2024-04-15T00:00:00Z'.slice(0, 10), user: 'test-user-two' }),
];
const daily = buildDailyBucketsArtifactsFromRows(periodRows);
const usage = buildUsageArtifactsFromRows(periodRows);
const modelDaily = makeModelDailyArtifacts(userRows);
const ingestionResult = ingestRows(periodRows);
const dates = [
  ...Array.from({ length: 29 }, (_, index) => `2024-02-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 30 }, (_, index) => `2024-04-${String(index + 1).padStart(2, '0')}`),
];

// Keep this registry exhaustive: discovery below fails when a new date chart is
// added without a full-month contract, rather than silently skipping coverage.
const contracts: { file: string; name: string; render: () => ReactElement }[] = [
  {
    file: 'charts/DailyConsumptionChart.tsx', name: 'USD',
    render: () => <DailyConsumptionChart data={aggregateDailyConsumption(modelDaily.dailyConsumption, daily.months ?? [])} />,
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
      <AnalysisProvider ingestionResult={ingestionResult} filename="test-report.csv" onReset={jest.fn()}>
        <UserDetailsView user="test-user-one" rows={periodRows}
          userQuotaValue="unknown" onBack={jest.fn()} />
      </AnalysisProvider>
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
    rerender(<UserConsumptionMetrics rows={userRows} periodRows={periodRows.filter(row => row.day.slice(0, 7) === '2024-02')} />);
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
