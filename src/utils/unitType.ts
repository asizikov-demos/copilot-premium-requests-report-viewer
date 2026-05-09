export function isRequestUnitType(unitType: string | undefined): boolean {
  return unitType === undefined || unitType.toLowerCase() === 'requests';
}
