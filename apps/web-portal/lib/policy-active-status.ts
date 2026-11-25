/**
 * Canonical current-policy rule for dashboard and register.
 * Fixed-term policies retain the pre-existing end-date check.
 * Life/Health policies explicitly recorded as active can have no fixed maturity.
 * An unknown maturity must never automatically make another insurance line active.
 */
export type ActivePolicyRecord = {
  business_line: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

export function isPolicyCurrentlyActive(policy: ActivePolicyRecord, todayKey: string): boolean {
  if (policy.end_date) return policy.end_date >= todayKey;
  const line = (policy.business_line ?? "").trim().toLowerCase();
  return (line === "life" || line === "health")
    && (policy.status ?? "").trim().toLowerCase() === "active"
    && !!policy.start_date && policy.start_date <= todayKey;
}
