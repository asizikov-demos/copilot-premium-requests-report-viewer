import { CSVData, ProcessedData, AnalysisResults } from '@/types/csv';

export interface UserSummary {
  user: string;
  totalRequests: number;
  modelBreakdown: Record<string, number>;
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
        modelBreakdown: {}
      });
    }

    const userSummary = userMap.get(row.user)!;
    userSummary.totalRequests += row.requestsUsed;
    
    if (!userSummary.modelBreakdown[row.model]) {
      userSummary.modelBreakdown[row.model] = 0;
    }
    userSummary.modelBreakdown[row.model] += row.requestsUsed;
  });

  return Array.from(userMap.values())
    .sort((a, b) => b.totalRequests - a.totalRequests);
}

export interface DailyCumulativeData {
  date: string;
  [user: string]: string | number; // Dynamic user columns
}

export function generateDailyCumulativeData(data: ProcessedData[]): DailyCumulativeData[] {
  if (data.length === 0) return [];

  // Sort data by timestamp
  const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Get unique users
  const users = Array.from(new Set(data.map(d => d.user))).sort();
  
  // Get date range
  const startDate = new Date(sortedData[0].timestamp);
  const endDate = new Date(sortedData[sortedData.length - 1].timestamp);
  
  // Initialize user cumulative totals
  const userTotals = new Map<string, number>();
  users.forEach(user => userTotals.set(user, 0));
  
  const result: DailyCumulativeData[] = [];
  
  // Iterate through each day
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    
    // Find all requests for this day
    const dayRequests = sortedData.filter(d => 
      d.timestamp.toISOString().split('T')[0] === dateStr
    );
    
    // Add requests to cumulative totals
    dayRequests.forEach(request => {
      const currentTotal = userTotals.get(request.user) || 0;
      userTotals.set(request.user, currentTotal + request.requestsUsed);
    });
    
    // Create data point for this day
    const dataPoint: DailyCumulativeData = { date: dateStr };
    users.forEach(user => {
      dataPoint[user] = userTotals.get(user) || 0;
    });
    
    result.push(dataPoint);
  }
  
  return result;
}
