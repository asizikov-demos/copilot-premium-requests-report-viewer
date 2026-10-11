import { PRICING } from '@/constants/pricing';
import type { CSVData } from '@/types/csv';

export const validCSVData: CSVData[] = [
  {
    date: '2025-06-03',
    username: 'test-user-one',
    model: 'gpt-4.1-2025-04-14',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    unit_type: 'ai-credits',
    quantity: '1.00',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-03',
    username: 'test-user-two',
    model: 'claude-3.7-sonnet-thought',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    unit_type: 'ai-credits',
    quantity: '2.50',
    total_monthly_quota: String(PRICING.BUSINESS_AI_CREDIT_QUOTA)
  },
  {
    date: '2025-06-04',
    username: 'test-user-three',
    model: 'gemini-2.0-flash',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    unit_type: 'ai-credits',
    quantity: '0.75',
    total_monthly_quota: 'Unknown'
  },
  {
    date: '2025-06-04',
    username: 'test-user-one',
    model: 'o3-mini',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    unit_type: 'ai-credits',
    quantity: '1.25',
    total_monthly_quota: 'Unknown'
  }
];

export const validCSVString = `date,username,product,sku,unit_type,model,quantity,total_monthly_quota
2025-06-03,test-user-one,copilot,copilot_ai_credit,ai-credits,gpt-4.1-2025-04-14,1.00,Unknown
2025-06-03,test-user-two,copilot,copilot_ai_credit,ai-credits,claude-3.7-sonnet-thought,2.50,${PRICING.BUSINESS_AI_CREDIT_QUOTA}
2025-06-04,test-user-three,copilot,copilot_ai_credit,ai-credits,gemini-2.0-flash,0.75,Unknown
2025-06-04,test-user-one,copilot,copilot_ai_credit,ai-credits,o3-mini,1.25,Unknown`;
