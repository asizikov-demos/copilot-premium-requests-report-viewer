interface AicFields {
  aicQuantity?: number;
  aicGrossAmount?: number;
}

export function hasAicFields(rows: Iterable<AicFields>): boolean {
  for (const row of rows) {
    if (row.aicQuantity !== undefined || row.aicGrossAmount !== undefined) {
      return true;
    }
  }

  return false;
}
