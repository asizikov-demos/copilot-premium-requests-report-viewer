/**
 * Shared types for analytics utilities
 */

export interface UserSummary {
  user: string;
  totalRequests: number;
  modelBreakdown: Record<string, number>;
  organization?: string;
  costCenter?: string;
}
