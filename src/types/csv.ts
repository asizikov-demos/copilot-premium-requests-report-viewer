// CSV FORMAT (expanded billing export)
// Uses daily date (YYYY-MM-DD) & additional commercial + cost fields.
export interface CSVData {
  date: string; // Source billing date, normalized to a UTC day without local conversion
  username: string;
  product?: string;
  sku?: string;
  unit_type?: string;
  model: string;
  quantity: string; // may be fractional (e.g. '3.6')
  total_monthly_quota?: string; // numeric or 'Unknown'
  applied_cost_per_quantity?: string; // numeric string
  gross_amount?: string; // numeric string
  discount_amount?: string; // numeric string
  net_amount?: string; // numeric string
  organization?: string;
  cost_center_name?: string;
  aic_quantity?: string; // numeric string
  aic_gross_amount?: string; // numeric string
  input?: string;
  output?: string;
  cache_read?: string;
  cache_write?: string;
  app_client_id?: string;
  image_input?: string;
  image_output?: string;
  total_input_tokens?: string;
  total_output_tokens?: string;
  total_cache_read_tokens?: string;
  total_cache_creation_tokens?: string;
}

export interface AnalysisResults {
  timeFrame: {
    start: string;
    end: string;
  };
  totalUniqueUsers: number;
  usersExceedingQuota: number;
  creditsByModel: Array<{
    model: string;
    totalCredits: number;
  }>;
  quotaBreakdown: {
    unknown: string[];
    business: string[];
    enterprise: string[];
    mixed: boolean;
    suggestedPlan: 'business' | 'enterprise' | null;
  };
}

// User-specific daily data for individual user charts
export interface UserDailyData {
  date: string;
  [model: string]: string | number; // Dynamic model columns for stacked bars
  totalCumulative: number; // Running total for line chart
}

// Coding Agent Adoption types
export interface CodingAgentUser {
  user: string;
  totalCredits: number;
  codingAgentCredits: number;
  codingAgentPercentage: number;
  quota: number | 'unknown';
  models: string[]; // coding agent models used
}

export interface CodingAgentAnalysis {
  totalUsers: number;
  totalUniqueUsers: number; // for percentage calculation
  totalCodingAgentCredits: number;
  adoptionRate: number; // percentage of total users
  users: CodingAgentUser[];
}

// Code Review Adoption types
interface CodeReviewUser {
  user: string;
  totalCredits: number;
  codeReviewCredits: number;
  codeReviewPercentage: number;
  quota: number | 'unknown';
  models: string[];
}

export interface CodeReviewAnalysis {
  totalUsers: number;
  totalUniqueUsers: number;
  totalCodeReviewCredits: number;
  adoptionRate: number;
  users: CodeReviewUser[];
}
