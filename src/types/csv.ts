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
  selectedPlan: 'business' | 'enterprise';
  currentQuota: number;
  onClose: () => void;
}
