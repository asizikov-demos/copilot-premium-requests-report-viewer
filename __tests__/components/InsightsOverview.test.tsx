import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InsightsOverview } from '@/components/InsightsOverview';
import { PRICING } from '@/constants/pricing';
import type { ProcessedData } from '@/types/csv';
import {
  buildFeatureUsageArtifactsFromProcessedData,
  buildQuotaArtifactsFromProcessedData,
  buildUsageArtifactsFromProcessedData,
} from '@/utils/ingestion/analytics';

import { makeProcessedData } from '../helpers/testUtils';

function propsFor(rows: ProcessedData[]) {
  const usageArtifacts = buildUsageArtifactsFromProcessedData(rows);
  return {
    processedData: rows,
    userData: usageArtifacts.users,
    usageArtifacts,
    quotaArtifacts: buildQuotaArtifactsFromProcessedData(rows),
    featureUsageArtifacts: buildFeatureUsageArtifactsFromProcessedData(rows),
  };
}

const rows = [
  makeProcessedData({ user: 'test-user-power', creditsUsed: PRICING.BUSINESS_AI_CREDIT_QUOTA, model: 'Code Review' }),
  makeProcessedData({ user: 'test-user-average', creditsUsed: PRICING.BUSINESS_AI_CREDIT_QUOTA * 0.6 }),
  makeProcessedData({ user: 'test-user-low', creditsUsed: PRICING.BUSINESS_AI_CREDIT_QUOTA * 0.1 }),
  makeProcessedData({ user: 'test-user-unknown', creditsUsed: 10, quotaValue: 'unknown' }),
];

describe('InsightsOverview', () => {
  it('shows compact groups and feature reach without an initial user table', () => {
    render(<InsightsOverview {...propsFor(rows)} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worth a closer look' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Feature reach' })).toBeInTheDocument();
    for (const name of ['Power users', 'Average users', 'Low adoption']) {
      expect(screen.getByRole('button', { name: new RegExp(`${name}.*1 / 4 users`) })).toBeInTheDocument();
    }
    expect(screen.getByText(/1 user has an unknown quota/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Code Review: 1 of 4 users' })).toBeInTheDocument();
  });

  it('explores each cohort and restores keyboard focus on return', async () => {
    const user = userEvent.setup();
    render(<InsightsOverview {...propsFor(rows)} />);
    for (const [group, username] of [['Power users', 'test-user-power'], ['Average users', 'test-user-average'], ['Low adoption', 'test-user-low']]) {
      await user.click(screen.getByRole('button', { name: new RegExp(`${group}.*Explore`) }));
      expect(screen.getByRole('heading', { name: group })).toHaveFocus();
      expect(within(screen.getByRole('table')).getByText(username)).toBeInTheDocument();
      expect(screen.queryByText('test-user-unknown')).not.toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'AI Credits' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Back to overview/ }));
      expect(screen.getByRole('button', { name: new RegExp(`${group}.*Explore`) })).toHaveFocus();
    }
  });

  it('searches the full group, shows all users, and handles no matches', async () => {
    const user = userEvent.setup();
    const manyRows = Array.from({ length: 25 }, (_, index) => makeProcessedData({ user: `test-user-${index}`, creditsUsed: index }));
    render(<InsightsOverview {...propsFor(manyRows)} />);
    await user.click(screen.getByRole('button', { name: /Low adoption.*Explore/ }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'Show all 25' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(26);
    await user.click(screen.getByRole('button', { name: 'Show fewer' }));
    await user.type(screen.getByRole('searchbox'), 'TEST-USER-24');
    expect(screen.getByRole('status')).toHaveTextContent('1 matching user');
    expect(screen.getByText('test-user-24')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), '-missing');
    expect(screen.getByText('No users match your search.')).toBeInTheDocument();
  });

  it('opens adoption recommendations and drills into the affected group', async () => {
    const user = userEvent.setup();
    render(<InsightsOverview {...propsFor([rows[2]])} />);
    await user.click(screen.getByText('Training Opportunity for Low-Adoption Users'));
    expect(screen.getByText(/less than 45% of their included AI Credits/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Explore low-adoption users/ }));
    expect(screen.getByText('test-user-low')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back to overview/ }));
    expect(screen.getByRole('button', { name: /Low adoption.*Explore/ })).toHaveFocus();
  });

  it('retains unattributed feature credits without counting them as users', () => {
    const props = propsFor([
      makeProcessedData({ user: 'test-user-one', model: 'Code Review', creditsUsed: 20 }),
      makeProcessedData({ user: '', model: 'Code Review', creditsUsed: 30, isUnattributedUsage: true, usageBucket: 'unattributed_ai_credit' }),
    ]);
    render(<InsightsOverview {...props} processedData={[]} />);
    expect(screen.getByRole('img', { name: 'Code Review: 1 of 1 users' })).toBeInTheDocument();
    expect(screen.getByText('50.00 AI Credits')).toBeInTheDocument();
    expect(screen.getByText('20.0 credits / active user')).toBeInTheDocument();
  });

  it('shows empty states without invalid ratios or misleading health claims', async () => {
    const user = userEvent.setup();
    const { container } = render(<InsightsOverview {...propsFor([])} />);
    expect(screen.getByText('No named-user consumption is available for this period.')).toBeInTheDocument();
    expect(screen.getByText(/No adoption recommendations for this period/)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    await user.click(screen.getByRole('button', { name: /Power users.*Explore/ }));
    expect(screen.getByText('No users in this consumption group.')).toBeInTheDocument();
  });

  it('requires one billing month and updates the selected group after a period change', async () => {
    const user = userEvent.setup();
    const laterRow = makeProcessedData({ user: 'test-user-later', creditsUsed: 10, timestamp: new Date('2025-07-01T00:00:00Z') });
    const { rerender } = render(<InsightsOverview {...propsFor([...rows, laterRow])} />);
    expect(screen.getByText(/Select one billing month/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Low adoption/ })).not.toBeInTheDocument();
    rerender(<InsightsOverview {...propsFor(rows)} />);
    await user.click(screen.getByRole('button', { name: /Low adoption.*Explore/ }));
    expect(screen.getByText('test-user-low')).toBeInTheDocument();
    rerender(<InsightsOverview {...propsFor([laterRow])} />);
    expect(screen.queryByText('test-user-low')).not.toBeInTheDocument();
    expect(screen.getByText('test-user-later')).toBeInTheDocument();
  });

  it('retains the row-based fallback when optional usage artifacts are absent', () => {
    const props = propsFor(rows);
    render(<InsightsOverview userData={props.userData} processedData={rows} featureUsageArtifacts={props.featureUsageArtifacts} />);
    expect(screen.getByRole('button', { name: /Power users.*1 \/ 4 users/ })).toBeInTheDocument();
    expect(screen.getByText(/1 user has an unknown quota/)).toBeInTheDocument();
  });
});
