import { getUsageUnitKind, isAiCreditSku } from '@/utils/unitType';

describe('AI-credit unit classification', () => {
  it.each([
    ['ai-credits', undefined],
    ['ai-credit', undefined],
    [undefined, 'copilot_ai_credit'],
    ['', 'code_quality_ai_credit'],
  ])('accepts supported AI-credit unit %p with SKU %p', (unitType, sku) => {
    expect(getUsageUnitKind(unitType, sku)).toBe('ai_credit');
  });

  it.each([
    ['requests', 'copilot_ai_credit'],
    ['ai-credits', 'copilot_premium_request'],
    [undefined, 'coding_agent_premium_request'],
    [undefined, undefined],
    ['unrecognized', 'copilot_ai_credit'],
  ])('rejects unsupported unit %p with SKU %p', (unitType, sku) => {
    expect(getUsageUnitKind(unitType, sku)).toBe('unknown');
  });

  it('recognizes AI-credit SKUs without treating premium-request SKUs as credits', () => {
    expect(isAiCreditSku(' copilot_ai_credit ')).toBe(true);
    expect(isAiCreditSku('copilot_premium_request')).toBe(false);
    expect(isAiCreditSku(undefined)).toBe(false);
  });
});
