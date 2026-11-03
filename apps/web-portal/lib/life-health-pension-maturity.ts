/** Pension products may be issued without a fixed policy maturity date. */
export function isPensionLifePolicy(businessLine: string | null | undefined, productName: string | null | undefined): boolean {
  return businessLine?.trim().toLowerCase() === "life" && /\bpension\b/i.test(productName ?? "");
}
