/**
 * Shared types for analytics utilities
 */

export interface UserSummary {
  user: string;
  totalCredits: number;
  modelBreakdown: Record<string, number>;
  organization?: string;
  costCenter?: string;
  costCenters?: string[];
}
