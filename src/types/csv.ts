// CSV FORMAT (expanded billing export)
// Uses daily date (YYYY-MM-DD) & additional commercial + cost fields.
export interface CSVData {
  date: string; // YYYY-MM-DD (UTC day) — convert to midnight UTC timestamp
  username: string;
  product?: string;
  sku?: string;
  model: string;
  quantity: string; // may be fractional (e.g. '3.6')
  exceeds_quota?: string; // 'True' | 'False'
  total_monthly_quota?: string; // numeric or 'Unlimited'
  applied_cost_per_quantity?: string; // numeric string
  gross_amount?: string; // numeric string
  discount_amount?: string; // numeric string
  net_amount?: string; // numeric string
  organization?: string;
  cost_center_name?: string;
}

// Processed record produced from CSV row.
export interface ProcessedData {
  timestamp: Date; // Normalized UTC timestamp (date + T00:00:00Z)
  user: string; // username from CSV
  model: string; // normalized raw model name (prefixes like 'Auto: ' stripped later in analytics if needed)
  requestsUsed: number; // float-safe parsed quantity/requests used
  exceedsQuota: boolean; // derived from boolean field (defaults false if absent)
  totalQuota: string; // original string (numeric or 'Unlimited')
  quotaValue: number | 'unlimited'; // Parsed quota value using pricing constants/logic
  // Cached UTC-derived keys
  iso: string; // Full UTC ISO string (timestamp.toISOString())
  dateKey: string; // YYYY-MM-DD (first 10 chars of ISO) for fast daily grouping
  monthKey: string; // YYYY-MM (first 7 chars of ISO) for fast monthly grouping
  epoch: number; // Milliseconds since epoch (timestamp.getTime()) for arithmetic
  // Extended fields from CSV
  product?: string;
  sku?: string;
  organization?: string;
  costCenter?: string;
  appliedCostPerQuantity?: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
}

export interface AnalysisResults {
  timeFrame: {
    start: string;
    end: string;
  };
  totalUniqueUsers: number;
  usersExceedingQuota: number;
  requestsByModel: Array<{
    model: string;
    totalRequests: number;
  }>;
  quotaBreakdown: {
    unlimited: string[];
    business: string[]; // Users with Business quota (300)
    enterprise: string[]; // Users with Enterprise quota (1000)
    mixed: boolean;
    suggestedPlan: 'business' | 'enterprise' | null;
  };
}

export interface PowerUserScore {
  user: string;
  totalScore: number;
  totalRequests: number;
  breakdown: {
    diversityScore: number;
    specialFeaturesScore: number;
    visionScore: number;
    balanceScore: number;
  };
  modelUsage: {
    light: number;
    medium: number;
    heavy: number;
    special: number;
    vision: number;
    uniqueModels: number;
  };
}

export interface PowerUsersAnalysis {
  powerUsers: PowerUserScore[];
  totalQualifiedUsers: number;
}

// User-specific daily data for individual user charts
export interface UserDailyData {
  date: string;
  [model: string]: string | number; // Dynamic model columns for stacked bars
  totalCumulative: number; // Running total for line chart
}

// Props for the new modal component
export interface UserConsumptionModalProps {
  user: string;
  processedData: ProcessedData[]; // Raw data filtered for this user
  userQuotaValue: number | 'unlimited'; // User's actual quota from CSV
  onClose: () => void;
}

// Coding Agent Adoption types
export interface CodingAgentUser {
  user: string;
  totalRequests: number;
  codingAgentRequests: number;
  codingAgentPercentage: number;
  quota: number | 'unlimited';
  models: string[]; // coding agent models used
}

export interface CodingAgentAnalysis {
  totalUsers: number;
  totalUniqueUsers: number; // for percentage calculation
  totalCodingAgentRequests: number;
  adoptionRate: number; // percentage of total users
  users: CodingAgentUser[];
}

export interface CodingAgentOverviewProps {
  codingAgentUsers: CodingAgentUser[];
  totalUniqueUsers: number;
  adoptionRate: number;
  processedData: ProcessedData[];
  onBack: () => void;
}
