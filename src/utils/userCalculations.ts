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
  quota: number | 'unlimited'
): number {
  if (quota === 'unlimited') {
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
 * Get filtered user data for a specific user
 */
export function getUserData(
  processedData: ProcessedData[], 
  userName: string
): ProcessedData[] {
  return processedData.filter(d => d.user === userName);
}
