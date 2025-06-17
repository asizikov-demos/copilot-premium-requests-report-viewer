import { CSVData, ProcessedData, AnalysisResults, PowerUserScore, PowerUsersAnalysis } from '@/types/csv';

// Constants
const DEFAULT_MIN_REQUESTS = 20;
const MAX_POWER_USERS_DISPLAYED = 20;

export interface UserSummary {
  user: string;
  totalRequests: number;
  modelBreakdown: Record<string, number>;
}

// Define proper types for model categories
interface ModelCategories {
  light: readonly string[];
  heavy: readonly string[];
  special: readonly string[];
}

interface SpecialFeatureConfig {
  readonly keyword: string;
  readonly score: number;
  readonly description: string;
}

// Configuration for special features with scores
// 'padawan' is a legacy name for 'coding agent'. it's kept for backward compatibility with old reports exported before the model was renamed.
const SPECIAL_FEATURES_CONFIG: readonly SpecialFeatureConfig[] = [
  { keyword: 'code review', score: 8, description: 'Code Review feature usage' },
  { keyword: 'coding agent', score: 8, description: 'Coding Agent feature usage' },
  { keyword: 'padawan', score: 8, description: 'Padawan feature usage' },
  { keyword: 'spark', score: 4, description: 'Spark feature usage' }
] as const;

// Maximum possible special features score
const MAX_SPECIAL_FEATURES_SCORE = 20;

// Model classification with proper typing
const MODEL_CATEGORIES: ModelCategories = {
  light: ['gemini-2.0-flash', 'o3-mini', 'o-4-mini'],
  heavy: ['claude-opus-4', 'claude-3.7-sonnet-thought', 'o3', 'o4', 'gpt-4.5'],
  special: SPECIAL_FEATURES_CONFIG.map(f => f.keyword)
} as const;

// Type for model category
type ModelCategory = 'light' | 'medium' | 'heavy' | 'special';

function categorizeModel(modelName: string): ModelCategory {
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

function calculateSpecialFeaturesScore(models: string[]): number {
  const modelSet = new Set(models.map(m => m.toLowerCase()));
  
  let totalScore = 0;
  const usedFeatureTypes = new Set<string>();
  
  const featureGroups = [
    { type: 'code_review', keywords: ['code review'], score: 8 },
    { type: 'coding_agent', keywords: ['coding agent', 'padawan'], score: 8 }, // Padawan is legacy name for Coding Agent
    { type: 'spark', keywords: ['spark'], score: 4 }
  ];
  
  for (const group of featureGroups) {
    const hasFeature = group.keywords.some(keyword => modelSet.has(keyword));
    
    if (hasFeature && !usedFeatureTypes.has(group.type)) {
      totalScore += group.score;
      usedFeatureTypes.add(group.type);
    }
  }
  
  // Cap at maximum score
  return Math.min(totalScore, MAX_SPECIAL_FEATURES_SCORE);
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
  
  const specialFeaturesScore = calculateSpecialFeaturesScore(models);
  
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

export function analyzePowerUsers(data: ProcessedData[], minRequestsThreshold: number = DEFAULT_MIN_REQUESTS): PowerUsersAnalysis {
  const userSummaries = analyzeUserData(data);
  
  // Filter users with configurable minimum requests
  const qualifiedUsers = userSummaries.filter(user => user.totalRequests >= minRequestsThreshold);
  
  // Calculate power user scores
  const powerUserScores = qualifiedUsers.map(calculatePowerUserScore);
  
  // Sort by total score and take top users
  const topPowerUsers = powerUserScores
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, MAX_POWER_USERS_DISPLAYED);
  
  return {
    powerUsers: topPowerUsers,
    totalQualifiedUsers: qualifiedUsers.length,
  };
}

// Generate daily model breakdown data for a specific user
export function generateUserDailyModelData(data: ProcessedData[], userName: string): import('@/types/csv').UserDailyData[] {
  // Filter data for the specific user
  const userData = data.filter(d => d.user === userName);
  
  if (userData.length === 0) return [];

  // Sort ALL data by timestamp to get the full date range from the CSV
  const allSortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Get the FULL date range from the entire CSV file (not just this user)
  const startDate = new Date(allSortedData[0].timestamp);
  const endDate = new Date(allSortedData[allSortedData.length - 1].timestamp);
  
  // Sort user data by timestamp
  const sortedUserData = [...userData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Get ALL models used by this user across all days
  const userModels = Array.from(new Set(userData.map(d => d.model))).sort();
  
  // Track cumulative total across all days
  let cumulativeTotal = 0;
  
  const result: import('@/types/csv').UserDailyData[] = [];
  
  // Iterate through EVERY day in the full CSV date range
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    
    // Find all requests for this specific day for this user
    const dayRequests = sortedUserData.filter(d => 
      d.timestamp.toISOString().split('T')[0] === dateStr
    );
    
    // Initialize daily model breakdown with zeros for ALL models
    const dailyByModel: Record<string, number> = {};
    userModels.forEach(model => {
      dailyByModel[model] = 0;
    });
    
    // Calculate actual requests per model for this day
    let dailyTotal = 0;
    dayRequests.forEach(request => {
      dailyByModel[request.model] += request.requestsUsed;
      dailyTotal += request.requestsUsed;
    });
    
    // Update cumulative total (running sum)
    cumulativeTotal += dailyTotal;
    
    // Create data point for this day
    const dataPoint: import('@/types/csv').UserDailyData = { 
      date: dateStr,
      totalCumulative: cumulativeTotal,
      ...dailyByModel
    };
    
    result.push(dataPoint);
  }
  
  return result;
}

/* 
Example usage verification:
Input: Full CSV date range is Day1 to Day5, but user "TestUser" only has data on Day1, Day3, Day5:
Day1: Model1=10, Model2=3, Model4=5 → dailyTotal=18, cumulative=18
Day2: (no requests, but day exists in CSV) → dailyTotal=0, cumulative=18
Day3: Model1=5, Model3=10 → dailyTotal=15, cumulative=33
Day4: (no requests, but day exists in CSV) → dailyTotal=0, cumulative=33
Day5: Model2=2 → dailyTotal=2, cumulative=35

Expected output (ALL days from CSV range):
[
  { date: "day1", Model1: 10, Model2: 3, Model3: 0, Model4: 5, totalCumulative: 18 },
  { date: "day2", Model1: 0, Model2: 0, Model3: 0, Model4: 0, totalCumulative: 18 },
  { date: "day3", Model1: 5, Model2: 0, Model3: 10, Model4: 0, totalCumulative: 33 },
  { date: "day4", Model1: 0, Model2: 0, Model3: 0, Model4: 0, totalCumulative: 33 },
  { date: "day5", Model1: 0, Model2: 2, Model3: 0, Model4: 0, totalCumulative: 35 }
]

Chart will show:
- Day1: stacked bar with Model1(10) + Model2(3) + Model4(5) = 18 total height
- Day2: no bar (height 0)
- Day3: stacked bar with Model1(5) + Model3(10) = 15 total height  
- Day4: no bar (height 0)
- Day5: bar with Model2(2) = 2 total height
- Black line: 18 → 18 → 33 → 33 → 35 (cumulative)
*/

// Export utility functions for testing
export { calculateSpecialFeaturesScore, SPECIAL_FEATURES_CONFIG, MAX_SPECIAL_FEATURES_SCORE };
