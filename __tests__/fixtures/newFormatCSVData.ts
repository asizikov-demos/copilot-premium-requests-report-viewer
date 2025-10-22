import { NewCSVData } from '@/types/csv';

// Minimal representative sample rows of the NEW expanded CSV format.
export const newFormatRows: NewCSVData[] = [
  {
    date: '2025-10-01',
    username: 'alice',
    product: 'copilot',
    sku: 'copilot_premium_request',
    model: 'Claude Sonnet 4',
    quantity: '3.6',
    exceeds_quota: 'False',
    total_monthly_quota: '1000',
    applied_cost_per_quantity: '0.04',
    gross_amount: '0.144',
    discount_amount: '0',
    net_amount: '0.144',
    organization: 'org-alpha',
    cost_center_name: 'CC-Alpha'
  },
  {
    date: '2025-10-02',
    username: 'bob',
    product: 'copilot',
    sku: 'copilot_premium_request',
    model: 'GPT-5',
    quantity: '12',
    exceeds_quota: 'False',
    total_monthly_quota: 'Unlimited',
    applied_cost_per_quantity: '0.04',
    gross_amount: '0.48',
    discount_amount: '0',
    net_amount: '0.48',
    organization: 'org-beta',
    cost_center_name: 'CC-Beta'
  }
];
