/** Normalize copied policy and vehicle identifier fields without altering punctuation. */
export function normalizePolicyIdentifier(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}
export function normalizePolicyIdentifierFields<T extends { policyNo: string; chassisNo: string; engineNo: string }>(values: T): T {
  return { ...values, policyNo: normalizePolicyIdentifier(values.policyNo), chassisNo: normalizePolicyIdentifier(values.chassisNo), engineNo: normalizePolicyIdentifier(values.engineNo) };
}
