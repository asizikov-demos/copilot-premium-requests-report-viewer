import { CSVData, ProcessedData, AnalysisResults } from '@/types/csv';
import multipliersData from './multipliers.json';

export interface UserSummary {
  user: string;
  totalRequests: number;
  totalRequestsWithMultipliers: number;
  modelBreakdown: Record<string, number>;
}

interface ModelMultiplier {
  multiplier: number;
  name: string;
  prefix: string;
}

function getModelMultiplier(modelName: string): number {
  const model = multipliersData.models.find((m: ModelMultiplier) => 
    modelName.toLowerCase().startsWith(m.prefix.toLowerCase())
  );
  return model ? model.multiplier : 1;
}

export function processCSVData(rawData: CSVData[]): ProcessedData[] {
  return rawData.map(row => ({
    timestamp: new Date(row.Timestamp),
    user: row.User,
    model: row.Model,
    requestsUsed: parseFloat(row['Requests Used']),
    exceedsQuota: row['Exceeds Monthly Quota'].toLowerCase() === 'true',
    totalQuota: row['Total Monthly Quota']
  }));
}

export function analyzeData(data: ProcessedData[]): AnalysisResults {
  if (data.length === 0) {
    return {
      timeFrame: { start: '', end: '' },
      totalUniqueUsers: 0,
      usersExceedingQuota: 0,
      requestsByModel: []
    };
  }

  // Sort data by timestamp
  const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Time frame
  const timeFrame = {
    start: sortedData[0].timestamp.toISOString().split('T')[0],
    end: sortedData[sortedData.length - 1].timestamp.toISOString().split('T')[0]
  };

  // Unique users
  const uniqueUsers = new Set(data.map(row => row.user));
  const totalUniqueUsers = uniqueUsers.size;

  // Users exceeding quota
  const usersExceedingQuota = new Set(
    data.filter(row => row.exceedsQuota).map(row => row.user)
  ).size;

  // Requests by model
  const modelRequests = new Map<string, number>();
  data.forEach(row => {
    const currentTotal = modelRequests.get(row.model) || 0;
    modelRequests.set(row.model, currentTotal + row.requestsUsed);
  });

  const requestsByModel = Array.from(modelRequests.entries())
    .map(([model, totalRequests]) => ({ model, totalRequests }))
    .sort((a, b) => b.totalRequests - a.totalRequests);

  return {
    timeFrame,
    totalUniqueUsers,
    usersExceedingQuota,
    requestsByModel
  };
}

export function analyzeUserData(data: ProcessedData[]): UserSummary[] {
  const userMap = new Map<string, UserSummary>();

  data.forEach(row => {
    if (!userMap.has(row.user)) {
      userMap.set(row.user, {
        user: row.user,
        totalRequests: 0,
        totalRequestsWithMultipliers: 0,
        modelBreakdown: {}
      });
    }

    const userSummary = userMap.get(row.user)!;
    userSummary.totalRequests += row.requestsUsed;
    userSummary.totalRequestsWithMultipliers += row.requestsUsed * getModelMultiplier(row.model);
    
    if (!userSummary.modelBreakdown[row.model]) {
      userSummary.modelBreakdown[row.model] = 0;
    }
    userSummary.modelBreakdown[row.model] += row.requestsUsed;
  });

  return Array.from(userMap.values())
    .sort((a, b) => b.totalRequests - a.totalRequests);
}
