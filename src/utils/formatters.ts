export function formatDecimalQuantity(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrency(value: number): string {
  return `$${formatDecimalQuantity(value)}`;
}
