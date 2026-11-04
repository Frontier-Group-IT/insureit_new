/**
 * Apply the selected date period to the already-authorized, control-filtered
 * policy rows. "All" removes only the month constraint, not RM/partner access.
 */
export function filterPolicyRegisterPeriod<T>(
  rows: readonly T[],
  scope: "mtd" | "all",
  from: string,
  to: string,
  businessDate: (row: T) => string,
): T[] {
  if (scope === "all") return [...rows];
  return rows.filter((row) => {
    const date = businessDate(row);
    return date >= from && date <= to;
  });
}
