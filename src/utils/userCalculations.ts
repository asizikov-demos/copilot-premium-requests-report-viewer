import { ProcessedData } from '@/types/csv';
import { PRICING } from '@/constants/pricing';

/**
 * Calculate total requests for a specific user
 */
export function calculateUserTotalRequests(
  processedData: ProcessedData[], 
  userName: string
): number {
  return processedData
    .filter(d => d.user === userName)
    .reduce((total, record) => total + record.requestsUsed, 0);
}

/**
 * Calculate overage requests for a user based on their specific quota
 */
export function calculateOverageRequests(
  totalRequests: number, 
  quota: number | 'unknown'
): number {
  if (quota === 'unknown') {
    return 0;
  }
  return Math.max(0, totalRequests - quota);
}

/**
 * Calculate overage requests for a user (legacy - maintains backward compatibility)
 */
export function calculateOverageRequestsLegacy(
  totalRequests: number, 
  quota: number
): number {
  return Math.max(0, totalRequests - quota);
}

/**
 * Calculate overage cost based on overage requests
 */
export function calculateOverageCost(overageRequests: number): number {
  return overageRequests * PRICING.OVERAGE_RATE_PER_REQUEST;
}

/**
 * Calculate billed overage requests and cost from report rows when billing fields are present.
 * Falls back to zeros when the report does not contain any explicit overage rows.
 */
export function calculateBilledOverageFromRows(
  processedData: ProcessedData[],
  userName?: string
): { overageRequests: number; overageCost: number; hasBilledOverageData: boolean } {
  const rows = userName ? processedData.filter((record) => record.user === userName) : processedData;
  const billedRows = rows.filter((record) => record.exceedsQuota);

  if (billedRows.length === 0) {
    return { overageRequests: 0, overageCost: 0, hasBilledOverageData: false };
  }

  const hasBillingAmounts = billedRows.some((record) =>
    [record.netAmount, record.grossAmount, record.discountAmount].some(
      (value) => typeof value === 'number' && Number.isFinite(value)
    )
  );

  const overageRequests = billedRows.reduce((total, record) => total + record.requestsUsed, 0);

  const overageCost = hasBillingAmounts
    ? billedRows.reduce((total, record) => {
        const netAmount =
          typeof record.netAmount === 'number' && Number.isFinite(record.netAmount)
            ? record.netAmount
            : undefined;
        const grossAmount =
          typeof record.grossAmount === 'number' && Number.isFinite(record.grossAmount)
            ? record.grossAmount
            : undefined;
        const discountAmount =
          typeof record.discountAmount === 'number' && Number.isFinite(record.discountAmount)
            ? record.discountAmount
            : undefined;

        if (netAmount !== undefined) {
          return total + netAmount;
        }

        if (grossAmount !== undefined) {
          return total + (grossAmount - (discountAmount ?? 0));
        }

        return total;
      }, 0)
    : 0;

  return {
    overageRequests,
    overageCost,
    hasBilledOverageData: hasBillingAmounts,
  };
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
