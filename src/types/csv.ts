// LEGACY CSV FORMAT (original premium request usage export)
export interface CSVData {
  Timestamp: string; // ISO timestamp string (already UTC; never shift)
  User: string; // username
  Model: string; // raw model name
  'Requests Used': string; // numeric string (integer historically, but parseFloat applied)
  'Exceeds Monthly Quota': string; // 'true' | 'false'
  'Total Monthly Quota': string; // numeric or 'Unlimited'
}

// NEW CSV FORMAT (expanded billing export)
// Uses daily date (YYYY-MM-DD) & additional commercial + cost fields.
export interface NewCSVData {
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

// Unified processed record produced from either legacy or new CSV row.
export interface ProcessedData {
  timestamp: Date; // Normalized UTC timestamp (legacy: original; new: date + T00:00:00Z)
  user: string; // legacy: User, new: username
  model: string; // normalized raw model name (prefixes like 'Auto: ' stripped later in analytics if needed)
  requestsUsed: number; // float-safe parsed quantity/requests used
  exceedsQuota: boolean; // derived from legacy/new boolean field (defaults false if absent)
  totalQuota: string; // original string (numeric or 'Unlimited')
  quotaValue: number | 'unlimited'; // Parsed quota value using pricing constants/logic
  // Extended (new format only; optional for legacy rows)
  product?: string;
  sku?: string;
  organization?: string;
  costCenter?: string;
  appliedCostPerQuantity?: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  // Metadata
  sourceFormat: 'legacy' | 'new';
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
