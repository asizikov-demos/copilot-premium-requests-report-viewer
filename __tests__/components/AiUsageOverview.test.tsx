import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type React from 'react';

import { AiUsageOverview } from '@/components/AiUsageOverview';
import { AnalysisContext } from '@/context/AnalysisContext';
import type { BillingArtifacts, TokenUsageArtifacts } from '@/utils/ingestion';

function createBillingArtifacts(): BillingArtifacts {
  return {
    totals: {
      gross: 0,
      discount: 0,
      net: 0,
      aicQuantity: 17,
      aicGrossAmount: 0,
      aicIncludedCredits: 0,
      aicAdditionalUsageGrossAmount: 0,
    },
    overage: { requests: 0, cost: 0, hasBilledOverageData: false },
    users: [
      { user: 'test-user-alpha', quantity: 0, overage: { requests: 0, cost: 0, hasBilledOverageData: false }, aicQuantity: 10 },
      { user: 'test-user-beta', quantity: 0, overage: { requests: 0, cost: 0, hasBilledOverageData: false }, aicQuantity: 5 },
      { user: 'test-user-gamma', quantity: 0, overage: { requests: 0, cost: 0, hasBilledOverageData: false }, aicQuantity: 2 },
    ],
    userMap: new Map(),
    orgTotals: new Map(),
    costCenterTotals: new Map(),
    billingByModel: new Map(),
    hasAnyBillingData: false,
    hasAnyAicData: true,
  };
}

function createTokenUsageArtifacts(): TokenUsageArtifacts {
  return {
    overall: {},
    byModel: new Map(),
    byUser: new Map([
      ['test-user-alpha', { inputTokens: 0, outputTokens: 3, cacheWriteTokens: 9 }],
      ['test-user-beta', { cacheReadTokens: 5 }],
    ]),
    byDayAndModel: new Map(),
    tokenRowCount: 2,
    hasTokenData: true,
  };
}

function renderOverview(tokenUsageArtifacts?: TokenUsageArtifacts) {
  const contextValue = {
    billingArtifacts: createBillingArtifacts(),
    tokenUsageArtifacts,
  } as React.ContextType<typeof AnalysisContext>;

  render(
    <AnalysisContext.Provider value={contextValue}>
      <AiUsageOverview />
    </AnalysisContext.Provider>
  );
}

describe('AiUsageOverview', () => {
  it('adds separately reported token fields to the source-AI-credit-ranked drivers', () => {
    renderOverview(createTokenUsageArtifacts());

    const table = screen.getByRole('table', { name: 'Users ranked by AI Credits consumption' });
    for (const label of ['Input tokens', 'Output tokens', 'Cache-read tokens', 'Cache-write tokens']) {
      expect(within(table).getByRole('columnheader', { name: label })).toBeInTheDocument();
    }

    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('test-user-alpha');
    expect(rows[1]).toHaveTextContent('10.00');
    expect(rows[1]).toHaveTextContent('0');
    expect(rows[1]).toHaveTextContent('3');
    expect(rows[1]).toHaveTextContent('N/A');
    expect(rows[1]).toHaveTextContent('9');
    expect(rows[2]).toHaveTextContent('test-user-beta');
    expect(rows[2]).toHaveTextContent('5.00');
    expect(rows[2]).toHaveTextContent('N/A');
    expect(rows[2]).toHaveTextContent('5');
    expect(rows[3]).toHaveTextContent('test-user-gamma');
    expect(rows[3]).toHaveTextContent('2.00');
    expect(rows[3]).toHaveTextContent('N/A');
  });

  it('keeps the legacy driver table unchanged when token data is absent', () => {
    renderOverview();

    const table = screen.getByRole('table', { name: 'Users ranked by AI Credits consumption' });
    expect(within(table).queryByRole('columnheader', { name: 'Input tokens' })).not.toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
  });
});
