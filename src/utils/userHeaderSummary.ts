import { PRICING } from '@/constants/pricing';
import { isCodeReviewModel, isCodingAgentModel } from '@/utils/productClassification';

export interface UserHeaderSummary {
  organizations: string[];
  costCenters: string[];
  daysActive: number;
  /** Days in the billing month; null when usage spans multiple months. */
  daysInPeriod: number | null;
  totalConsumed: number;
  /**
   * Billed split when billing columns exist (discounted vs. net credits);
   * otherwise a per-month split against the quota. Null when neither is available.
   */
  includedConsumed: number | null;
  additionalConsumed: number | null;
  /** Null when the export has no billing columns. */
  totalCost: number | null;
  additionalCost: number | null;
  cloudAgentUsed: boolean;
  codeReviewUsed: boolean;
}

interface HeaderUsage {
  day: string;
  quantity: number;
  model: string;
  sku?: string;
  organization?: string;
  costCenter?: string;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
}

function daysInUtcMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export class UserHeaderAccumulator {
  private monthlyCredits = new Map<string, number>();
  private activeDays = new Set<string>();
  private organizations = new Set<string>();
  private costCenters = new Set<string>();
  private totalConsumed = 0;
  private gross = 0;
  private discount = 0;
  private net = 0;
  private cloudAgentUsed = false;
  private codeReviewUsed = false;

  add(row: HeaderUsage): void {
    const month = row.day.slice(0, 7);
    this.monthlyCredits.set(month, (this.monthlyCredits.get(month) ?? 0) + row.quantity);
    this.totalConsumed += row.quantity;
    this.gross += row.grossAmount ?? 0;
    this.discount += row.discountAmount ?? 0;
    this.net += row.netAmount ?? 0;
    if (row.quantity > 0) this.activeDays.add(row.day);
    if (row.organization) this.organizations.add(row.organization);
    if (row.costCenter) this.costCenters.add(row.costCenter);
    this.cloudAgentUsed ||= isCodingAgentModel(row.model, row.sku);
    this.codeReviewUsed ||= isCodeReviewModel(row.model);
  }

  finalize() {
    return {
      organizations: [...this.organizations].sort(), costCenters: [...this.costCenters].sort(),
      daysActive: this.activeDays.size,
      daysInPeriod: this.monthlyCredits.size === 1 ? daysInUtcMonth([...this.monthlyCredits.keys()][0]) : null,
      monthlyCredits: this.monthlyCredits, totalConsumed: this.totalConsumed,
      gross: this.gross, discount: this.discount, net: this.net,
      cloudAgentUsed: this.cloudAgentUsed, codeReviewUsed: this.codeReviewUsed,
    };
  }
}

export function summarizeUserHeader(
  data: ReturnType<UserHeaderAccumulator['finalize']>,
  quota: number | 'unknown',
  hasBillingData: boolean,
): UserHeaderSummary {
  let includedConsumed: number | null = null;
  let additionalConsumed: number | null = null;
  if (hasBillingData) {
    includedConsumed = data.discount / PRICING.AI_CREDIT_USD_VALUE;
    additionalConsumed = data.net / PRICING.AI_CREDIT_USD_VALUE;
  } else if (quota !== 'unknown') {
    includedConsumed = 0;
    additionalConsumed = 0;
    for (const credits of data.monthlyCredits.values()) {
      includedConsumed += Math.min(credits, quota);
      additionalConsumed += Math.max(0, credits - quota);
    }
  }

  return {
    organizations: data.organizations,
    costCenters: data.costCenters,
    daysActive: data.daysActive,
    daysInPeriod: data.daysInPeriod,
    totalConsumed: data.totalConsumed,
    includedConsumed,
    additionalConsumed,
    totalCost: hasBillingData ? data.gross : null,
    additionalCost: hasBillingData ? data.net : null,
    cloudAgentUsed: data.cloudAgentUsed,
    codeReviewUsed: data.codeReviewUsed,
  };
}
