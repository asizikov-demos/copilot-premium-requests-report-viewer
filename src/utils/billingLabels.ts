export interface BillingCostLabels {
  gross: string;
  discount: string;
  discountSummary: string;
  net: string;
  netSummary: string;
}

export function getBillingCostLabels(isUsageBasedBilling: boolean): BillingCostLabels {
  return isUsageBasedBilling
    ? {
      gross: 'Gross Amount',
      discount: 'Included Credits',
      discountSummary: 'Included credits',
      net: 'Additional usage',
      netSummary: 'Additional usage',
    }
    : {
      gross: 'Gross',
      discount: 'Discount',
      discountSummary: 'Discounts',
      net: 'Net',
      netSummary: 'Net cost',
    };
}
