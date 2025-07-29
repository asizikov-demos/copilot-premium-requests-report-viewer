export interface CSVData {
  Timestamp: string;
  User: string;
  Model: string;
  'Requests Used': string;
  'Exceeds Monthly Quota': string;
  'Total Monthly Quota': string;
}

export interface ProcessedData {
  timestamp: Date;
  user: string;
  model: string;
  requestsUsed: number;
  exceedsQuota: boolean;
  totalQuota: string;
  quotaValue: number | 'unlimited'; // Parsed quota value
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
