import { ProcessedData } from '@/types/csv';
/**
 * Calculate total AI Credits for a specific user
 */
export function calculateUserTotalCredits(
  processedData: ProcessedData[], 
  userName: string
): number {
  return processedData
    .filter(d => d.user === userName)
    .reduce((total, record) => total + record.creditsUsed, 0);
}

/**
 * Calculate credits consumed beyond a user's quota.
 */
export function calculateExcessCredits(
  totalCredits: number,
  quota: number | 'unknown'
): number {
  if (quota === 'unknown') {
    return 0;
  }
  return Math.max(0, totalCredits - quota);
}

/**
 * Get filtered user data for a specific user
 */
export function getUserData(
  processedData: ProcessedData[], 
  userName: string
): ProcessedData[] {
  return processedData.filter(d => d.user === userName);
}

/**
 * Get a representative organization and cost center for a user.
 * Prefers the first non-empty values found in the processed data.
 */
export function getUserOrgMetadata(
  processedData: ProcessedData[],
  userName: string
): { organization?: string; costCenter?: string } {
  const userRows = processedData.filter(d => d.user === userName);
  const row = userRows.find(r => r.organization || r.costCenter);
  if (row) {
    return { organization: row.organization, costCenter: row.costCenter };
  }
  return {};
}
