/**
 * Normalize currency to paise using decimal digits rather than binary
 * floating-point arithmetic. Used at the UI boundary and on the server.
 * Returns null for missing / invalid values; callers decide whether blank is zero.
 */
export function normalizePolicyMoney(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().replace(/,/g, "");
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return null;
  const negative = match[1] === "-";
  const whole = BigInt(match[2]);
  const fractional = match[3] ?? "";
  let paise = whole * 100n + BigInt(fractional.padEnd(2, "0").slice(0, 2));
  if (fractional.length > 2 && Number(fractional[2]) >= 5) paise += 1n;
  if (paise === 0n) return "0.00";
  return `${negative ? "-" : ""}${paise / 100n}.${String(paise % 100n).padStart(2, "0")}`;
}

export function displayPolicyMoney(value: string): string {
  return value.trim() ? (normalizePolicyMoney(value) ?? value) : "";
}
