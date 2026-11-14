/**
 * Mirror Motor Policy Onboarding's inclusive validity periods on the web portal.
 * Dates are stored as ISO yyyy-mm-dd and calculated in UTC to avoid device timezone drift.
 */
export function motorCoverExpiry(from: string, years: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  if (!match || !Number.isInteger(years) || years < 1) return '';
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return '';
  const anniversary = new Date(Date.UTC(year + years, month - 1, day));
  anniversary.setUTCDate(anniversary.getUTCDate() - 1);
  return anniversary.toISOString().slice(0, 10);
}

export function motorValidityEnds(from: string, vehicleClass: string, policyProduct: string) {
  const isBundled = policyProduct === 'Bundled' && (vehicleClass === 'PCP' || vehicleClass === 'TWP');
  const multiYearEnd = isBundled ? motorCoverExpiry(from, vehicleClass === 'TWP' ? 5 : 3) : '';
  return {
    validUpto: motorCoverExpiry(from, 1),
    tpValidUpto: multiYearEnd,
    cpaValidUpto: multiYearEnd,
  };
}
