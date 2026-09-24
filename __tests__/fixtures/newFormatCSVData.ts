import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';

// Minimal representative sample rows of the NEW expanded CSV format.
export const newFormatRows: CSVData[] = [
  {
    date: '2025-10-01',
    username: 'test-user-one',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    unit_type: 'ai-credits',
    model: 'Claude Sonnet 4',
    quantity: '3.6',
    total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA),
    applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
    gross_amount: '0.036',
    discount_amount: '0',
    net_amount: '0.036',
    organization: 'test-org-one',
    cost_center_name: 'test-cost-center-one'
  },
  {
    date: '2025-10-02',
    username: 'test-user-two',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    unit_type: 'ai-credits',
    model: 'GPT-5',
    quantity: '12',
    total_monthly_quota: 'Unknown',
    applied_cost_per_quantity: String(PRICING.AI_CREDIT_USD_VALUE),
    gross_amount: '0.12',
    discount_amount: '0',
    net_amount: '0.12',
    organization: 'test-org-two',
    cost_center_name: 'test-cost-center-two'
  }
];
