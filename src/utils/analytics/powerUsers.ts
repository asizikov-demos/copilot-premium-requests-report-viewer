import { PowerUserScore, PowerUsersAnalysis, ProcessedData } from '@/types/csv';

export interface UserSummary {
  user: string; totalRequests: number; modelBreakdown: Record<string, number>;
}

function summarizeUsers(data: ProcessedData[]): UserSummary[] {
  const map = new Map<string, UserSummary>();
  for (const row of data) {
    let summary = map.get(row.user);
    if (!summary) { summary = { user: row.user, totalRequests: 0, modelBreakdown: {} }; map.set(row.user, summary); }
    summary.totalRequests += row.requestsUsed;
    summary.modelBreakdown[row.model] = (summary.modelBreakdown[row.model] || 0) + row.requestsUsed;
  }
  return Array.from(map.values()).sort((a,b)=> b.totalRequests - a.totalRequests);
}

const DEFAULT_MIN_REQUESTS = 20;
const MAX_POWER_USERS_DISPLAYED = 20;

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

export const SPECIAL_FEATURES_CONFIG: readonly SpecialFeatureConfig[] = [
  { keyword: 'code review', score: 8, description: 'Code Review feature usage' },
  { keyword: 'coding agent', score: 8, description: 'Coding Agent feature usage' },
  { keyword: 'padawan', score: 8, description: 'Padawan feature usage' },
  { keyword: 'spark', score: 4, description: 'Spark feature usage' }
] as const;

export const MAX_SPECIAL_FEATURES_SCORE = 20;

const MODEL_CATEGORIES: ModelCategories = {
  light: ['gemini-2.0-flash', 'o3-mini', 'o-4-mini'],
  heavy: ['claude-opus-4', 'claude-3.7-sonnet-thought', 'o3', 'o4', 'gpt-4.5'],
  special: SPECIAL_FEATURES_CONFIG.map(f => f.keyword)
} as const;

type ModelCategory = 'light' | 'medium' | 'heavy' | 'special';

function categorizeModel(modelName: string): ModelCategory {
  const lowerModel = modelName.toLowerCase();
  if (MODEL_CATEGORIES.special.some(special => lowerModel.includes(special.toLowerCase()))) return 'special';
  if (MODEL_CATEGORIES.heavy.some(heavy => lowerModel.includes(heavy.toLowerCase()))) return 'heavy';
  if (MODEL_CATEGORIES.light.some(light => lowerModel.includes(light.toLowerCase()))) return 'light';
  return 'medium';
}

function isVisionModel(modelName: string): boolean {
  return modelName.toLowerCase().includes('-vision');
}

export function calculateSpecialFeaturesScore(models: string[]): number {
  const modelSet = new Set(models.map(m => m.toLowerCase()));
  let totalScore = 0;
  const usedFeatureTypes = new Set<string>();
  const featureGroups = [
    { type: 'code_review', keywords: ['code review'], score: 8 },
    { type: 'coding_agent', keywords: ['coding agent', 'padawan'], score: 8 },
    { type: 'spark', keywords: ['spark'], score: 4 }
  ];
  for (const group of featureGroups) {
    const hasFeature = group.keywords.some(keyword => modelSet.has(keyword));
    if (hasFeature && !usedFeatureTypes.has(group.type)) {
      totalScore += group.score;
      usedFeatureTypes.add(group.type);
    }
  }
  return Math.min(totalScore, MAX_SPECIAL_FEATURES_SCORE);
}

export function calculatePowerUserScore(userSummary: UserSummary): PowerUserScore {
  const models = Object.keys(userSummary.modelBreakdown);
  const totalRequests = userSummary.totalRequests;
  let lightRequests = 0; let mediumRequests = 0; let heavyRequests = 0; let specialRequests = 0; let visionRequests = 0; let uniqueModels = 0;
  models.forEach(model => {
    const requests = userSummary.modelBreakdown[model];
    const category = categorizeModel(model);
    switch (category) {
      case 'light': lightRequests += requests; uniqueModels++; break;
      case 'medium': mediumRequests += requests; uniqueModels++; break;
      case 'heavy': heavyRequests += requests; uniqueModels++; break;
      case 'special': specialRequests += requests; break;
    }
    if (isVisionModel(model)) visionRequests += requests;
  });
  const diversityScore = Math.min(uniqueModels / 4, 1) * 30;
  const specialFeaturesScore = calculateSpecialFeaturesScore(models);
  const visionScore = Math.min((visionRequests / totalRequests) / 0.2, 1) * 15;
  const heavyRatio = heavyRequests / totalRequests;
  let balanceScore = 0;
  if (heavyRatio >= 0.2 && heavyRatio <= 0.4) balanceScore = 35; else if (heavyRatio < 0.1 || heavyRatio > 0.6) balanceScore = 0; else {
    if (heavyRatio < 0.2) balanceScore = 35 * (heavyRatio / 0.2); else balanceScore = 35 * (1 - (heavyRatio - 0.4) / 0.2);
  }
  const totalScore = diversityScore + specialFeaturesScore + visionScore + balanceScore;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    user: userSummary.user,
    totalScore: round(totalScore),
    totalRequests,
    breakdown: {
      diversityScore: round(diversityScore),
      specialFeaturesScore: round(specialFeaturesScore),
      visionScore: round(visionScore),
      balanceScore: round(balanceScore)
    },
    modelUsage: {
      light: round(lightRequests),
      medium: round(mediumRequests),
      heavy: round(heavyRequests),
      special: round(specialRequests),
      vision: round(visionRequests),
      uniqueModels
    }
  };
}

export function analyzePowerUsers(
  data: ProcessedData[],
  minRequestsThreshold: number = DEFAULT_MIN_REQUESTS
): PowerUsersAnalysis {
  const userSummaries: UserSummary[] = summarizeUsers(data);
  const qualifiedUsers: UserSummary[] = userSummaries.filter((u: UserSummary) => u.totalRequests >= minRequestsThreshold);
  const powerUserScores: PowerUserScore[] = qualifiedUsers.map(calculatePowerUserScore);
  const topPowerUsers: PowerUserScore[] = powerUserScores
    .sort((a: PowerUserScore, b: PowerUserScore) => b.totalScore - a.totalScore)
    .slice(0, MAX_POWER_USERS_DISPLAYED);
  return { powerUsers: topPowerUsers, totalQualifiedUsers: qualifiedUsers.length };
}
