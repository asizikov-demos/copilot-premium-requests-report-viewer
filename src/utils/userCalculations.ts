import { ProcessedData } from '@/types/csv';
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
