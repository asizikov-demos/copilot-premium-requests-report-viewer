import { ProcessedData } from '@/types/csv';

export function analyzeCodingAgentAdoption(data: ProcessedData[]): import('@/types/csv').CodingAgentAnalysis {
  if (data.length === 0) {
    return { totalUsers: 0, totalUniqueUsers: 0, totalCodingAgentRequests: 0, adoptionRate: 0, users: [] };
  }
  const allUsers = new Set(data.map(d => d.user));
  const totalUniqueUsers = allUsers.size;
  const userStats = new Map<string, { totalRequests: number; codingAgentRequests: number; models: Set<string>; quota: number | 'unlimited'; }>();
  data.forEach(row => {
    const isCodingAgent = row.model.toLowerCase().includes('coding agent') || row.model.toLowerCase().includes('padawan');
    if (!userStats.has(row.user)) {
      userStats.set(row.user, { totalRequests: 0, codingAgentRequests: 0, models: new Set(), quota: row.quotaValue });
    }
    const stats = userStats.get(row.user)!;
    stats.totalRequests += row.requestsUsed;
    if (isCodingAgent) {
      stats.codingAgentRequests += row.requestsUsed;
      stats.models.add(row.model);
    }
  });
  const actualCodingAgentUsers = Array.from(userStats.entries())
    .filter(([, stats]) => stats.codingAgentRequests > 0)
    .map(([user, stats]) => ({
      user,
      totalRequests: stats.totalRequests,
      codingAgentRequests: stats.codingAgentRequests,
      codingAgentPercentage: (stats.codingAgentRequests / stats.totalRequests) * 100,
      quota: stats.quota,
      models: Array.from(stats.models)
    }))
    .sort((a, b) => b.codingAgentRequests - a.codingAgentRequests);
  const totalCodingAgentRequests = actualCodingAgentUsers.reduce((sum, u) => sum + u.codingAgentRequests, 0);
  const adoptionRate = totalUniqueUsers > 0 ? (actualCodingAgentUsers.length / totalUniqueUsers) * 100 : 0;
  return { totalUsers: actualCodingAgentUsers.length, totalUniqueUsers, totalCodingAgentRequests, adoptionRate, users: actualCodingAgentUsers };
}
