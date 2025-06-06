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
