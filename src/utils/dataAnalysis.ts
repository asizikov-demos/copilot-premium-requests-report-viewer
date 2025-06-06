import { CSVData, ProcessedData, AnalysisResults, PowerUserScore, PowerUsersAnalysis } from '@/types/csv';

export interface UserSummary {
  user: string;
  totalRequests: number;
  modelBreakdown: Record<string, number>;
}

// Model classification constants
const MODEL_CATEGORIES = {
  light: ['gemini-2.0-flash', 'o3-mini', 'o-4-mini'],
  heavy: ['claude-opus-4', 'claude-3.7-sonnet-thought', 'o3', 'o4', 'gpt-4.5'],
  special: ['Code Review', 'Padawan']
};

function categorizeModel(modelName: string): 'light' | 'medium' | 'heavy' | 'special' {
  const lowerModel = modelName.toLowerCase();
  
  // Check special models first
  if (MODEL_CATEGORIES.special.some(special => lowerModel.includes(special.toLowerCase()))) {
    return 'special';
  }
  
  // Check heavy models
  if (MODEL_CATEGORIES.heavy.some(heavy => lowerModel.includes(heavy.toLowerCase()))) {
    return 'heavy';
  }
  
  // Check light models
  if (MODEL_CATEGORIES.light.some(light => lowerModel.includes(light.toLowerCase()))) {
    return 'light';
  }
  
  // Default to medium
  return 'medium';
}

function isVisionModel(modelName: string): boolean {
  return modelName.toLowerCase().includes('-vision');
}

function calculatePowerUserScore(userSummary: UserSummary): PowerUserScore {
  const models = Object.keys(userSummary.modelBreakdown);
  const totalRequests = userSummary.totalRequests;
  
  // Categorize model usage
  let lightRequests = 0;
  let mediumRequests = 0;
  let heavyRequests = 0;
  let specialRequests = 0;
  let visionRequests = 0;
  let uniqueModels = 0;
  
  models.forEach(model => {
    const requests = userSummary.modelBreakdown[model];
    const category = categorizeModel(model);
    
    switch (category) {
      case 'light':
        lightRequests += requests;
        uniqueModels++;
        break;
      case 'medium':
        mediumRequests += requests;
        uniqueModels++;
        break;
      case 'heavy':
        heavyRequests += requests;
        uniqueModels++;
        break;
      case 'special':
        specialRequests += requests;
        break;
    }
    
    if (isVisionModel(model)) {
      visionRequests += requests;
    }
  });
  
  // Calculate scores
  const diversityScore = Math.min(uniqueModels / 4, 1) * 30;
  
  const specialFeaturesScore = Math.min(
    (models.some(m => m.toLowerCase().includes('code review')) ? 10 : 0) +
    (models.some(m => m.toLowerCase().includes('padawan')) ? 10 : 0),
    20
  );
  
  const visionScore = Math.min((visionRequests / totalRequests) / 0.2, 1) * 15;
  
  const heavyRatio = heavyRequests / totalRequests;
  let balanceScore = 0;
  if (heavyRatio >= 0.2 && heavyRatio <= 0.4) {
    balanceScore = 35; // Optimal range
  } else if (heavyRatio < 0.1 || heavyRatio > 0.6) {
    balanceScore = 0; // Poor balance
  } else {
    // Linear decrease outside optimal range
    if (heavyRatio < 0.2) {
      balanceScore = 35 * (heavyRatio / 0.2);
    } else {
      balanceScore = 35 * (1 - (heavyRatio - 0.4) / 0.2);
    }
  }
  
  const totalScore = diversityScore + specialFeaturesScore + visionScore + balanceScore;
  
  return {
    user: userSummary.user,
    totalScore: Math.round(totalScore * 100) / 100,
    totalRequests,
    breakdown: {
      diversityScore: Math.round(diversityScore * 100) / 100,
      specialFeaturesScore: Math.round(specialFeaturesScore * 100) / 100,
      visionScore: Math.round(visionScore * 100) / 100,
      balanceScore: Math.round(balanceScore * 100) / 100,
    },
    modelUsage: {
      light: Math.round(lightRequests * 100) / 100,
      medium: Math.round(mediumRequests * 100) / 100,
      heavy: Math.round(heavyRequests * 100) / 100,
      special: Math.round(specialRequests * 100) / 100,
      vision: Math.round(visionRequests * 100) / 100,
      uniqueModels,
    },
  };
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

export function analyzePowerUsers(data: ProcessedData[]): PowerUsersAnalysis {
  const userSummaries = analyzeUserData(data);
  
  // Filter users with 20+ requests
  const qualifiedUsers = userSummaries.filter(user => user.totalRequests >= 20);
  
  // Calculate power user scores
  const powerUserScores = qualifiedUsers.map(calculatePowerUserScore);
  
  // Sort by total score and take top 20
  const topPowerUsers = powerUserScores
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);
  
  return {
    powerUsers: topPowerUsers,
    totalQualifiedUsers: qualifiedUsers.length,
  };
}
