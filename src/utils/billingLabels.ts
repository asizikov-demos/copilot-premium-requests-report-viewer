export interface BillingCostLabels {
  gross: string;
  discount: string;
  discountSummary: string;
  net: string;
  netSummary: string;
}

export function getBillingCostLabels(): BillingCostLabels {
  return {
      gross: 'Gross Amount',
      discount: 'Included Credits',
      discountSummary: 'Included credits',
      net: 'Additional usage',
      netSummary: 'Additional usage',
    };
}
