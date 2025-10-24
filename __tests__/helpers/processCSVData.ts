import { CSVData, ProcessedData, AnalysisResults } from '@/types/csv';
import { PRICING } from '@/constants/pricing';

// Lightweight replicas of removed legacy helpers for test isolation.
export function processCSVData(rawData: CSVData[]): ProcessedData[] {
  return rawData.map(row => {
    const timestamp = new Date(`${row.date}T00:00:00Z`);
    const iso = timestamp.toISOString();
    const dateKey = iso.substring(0,10);
    const monthKey = iso.substring(0,7);
    const totalQuotaRaw = row.total_monthly_quota || 'Unlimited';
    const quotaValue: number | 'unlimited' = totalQuotaRaw.toLowerCase && totalQuotaRaw.toLowerCase() === 'unlimited'
      ? 'unlimited'
      : (isNaN(Number(totalQuotaRaw)) ? 'unlimited' : Number(totalQuotaRaw));
    return {
      timestamp,
      user: row.username,
      model: row.model,
      requestsUsed: parseFloat(row.quantity),
      exceedsQuota: row.exceeds_quota ? row.exceeds_quota.toLowerCase() === 'true' : false,
      totalQuota: totalQuotaRaw,
      quotaValue,
      iso,
      dateKey,
      monthKey,
      epoch: timestamp.getTime(),
      product: row.product,
      sku: row.sku,
      organization: row.organization,
      costCenter: row.cost_center_name,
      appliedCostPerQuantity: row.applied_cost_per_quantity ? parseFloat(row.applied_cost_per_quantity) : undefined,
      grossAmount: row.gross_amount ? parseFloat(row.gross_amount) : undefined,
      discountAmount: row.discount_amount ? parseFloat(row.discount_amount) : undefined,
      netAmount: row.net_amount ? parseFloat(row.net_amount) : undefined,
    };
  });
}

export function analyzeData(data: ProcessedData[]): AnalysisResults {
  if (data.length === 0) {
    return {
      timeFrame: { start: '', end: '' },
      totalUniqueUsers: 0,
      usersExceedingQuota: 0,
      requestsByModel: [],
      quotaBreakdown: { unlimited: [], business: [], enterprise: [], mixed: false, suggestedPlan: null }
    };
  }
  const sorted = [...data].sort((a,b)=> a.timestamp.getTime()-b.timestamp.getTime());
  const timeFrame = { start: sorted[0].dateKey, end: sorted[sorted.length-1].dateKey };
  const uniqueUsers = new Set(data.map(d=>d.user));
  const userTotals = new Map<string, number>();
  const modelTotals = new Map<string, number>();
  data.forEach(r=>{ userTotals.set(r.user, (userTotals.get(r.user)||0)+r.requestsUsed); modelTotals.set(r.model,(modelTotals.get(r.model)||0)+r.requestsUsed); });
  const userQuotas = new Map<string, number | 'unlimited'>();
  data.forEach(r=> { if(!userQuotas.has(r.user)) userQuotas.set(r.user, r.quotaValue); });
  let usersExceeding = 0;
  for (const [u,total] of userTotals) { const q = userQuotas.get(u); if (q !== undefined && q !== 'unlimited' && total > q) usersExceeding++; }
  const requestsByModel = Array.from(modelTotals.entries()).map(([model,totalRequests])=>({model,totalRequests})).sort((a,b)=> b.totalRequests - a.totalRequests);
  const unlimited: string[] = []; const business: string[] = []; const enterprise: string[] = [];
  for (const [u,q] of userQuotas) { if (q === 'unlimited') unlimited.push(u); else if (q === PRICING.BUSINESS_QUOTA) business.push(u); else if (q === PRICING.ENTERPRISE_QUOTA) enterprise.push(u); }
  const types = [unlimited.length>0?'unlimited':null,business.length>0?'business':null,enterprise.length>0?'enterprise':null].filter(Boolean);
  const mixed = types.length > 1;
  let suggestedPlan: 'business' | 'enterprise' | null = null;
  if (!mixed && unlimited.length === 0) { if (business.length>0 && enterprise.length===0) suggestedPlan='business'; else if (enterprise.length>0 && business.length===0) suggestedPlan='enterprise'; }
  return { timeFrame, totalUniqueUsers: uniqueUsers.size, usersExceedingQuota: usersExceeding, requestsByModel, quotaBreakdown: { unlimited, business, enterprise, mixed, suggestedPlan } };
}
