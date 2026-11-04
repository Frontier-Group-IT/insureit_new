export type PolicyDateDecision = "allowed" | "otp_required" | "invalid" | "future";

export const POLICY_DATE_APPROVERS = [
  { key: "jatin", name: "Jatin Kumar Buwaniwala", email: "jatin.garg@insureit.in" },
  { key: "vishal", name: "Vishal Kochhar", email: "vishal.kochhar@insureit.in" },
  { key: "varun", name: "Varun Sabharwal", email: "varun.sabharwal@insureit.in" },
  { key: "gagan", name: "Gagan Singh", email: "gagan.singh@insureit.in" },
] as const;

export function indiaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

export function policyDateDecision(issuanceDate: string, currentIndiaDate = indiaDate()): PolicyDateDecision {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + "T00:00:00.000Z");
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    return { month: date.getUTCFullYear() * 12 + date.getUTCMonth(), day: date.getUTCDate() };
  };
  const policy = parse(issuanceDate);
  const current = parse(currentIndiaDate);
  if (!policy || !current) return "invalid";
  if (policy.month > current.month) return "future";
  if (policy.month === current.month) return "allowed";
  if (policy.month === current.month - 1 && current.day <= 15) return "allowed";
  return "otp_required";
}

export function needsPolicyDateApproval(
  issuanceDate: string,
  originalIssuanceDate?: string | null,
  currentIndiaDate = indiaDate(),
): boolean {
  if (originalIssuanceDate === issuanceDate) return false;
  return policyDateDecision(issuanceDate, currentIndiaDate) === "otp_required";
}

/** Human-readable reason computed from the same India-calendar cutoff as OTP eligibility. */
export function policyDateApprovalReason(issuanceDate: string, currentIndiaDate = indiaDate()): string | null {
  if (policyDateDecision(issuanceDate, currentIndiaDate) !== "otp_required") return null;
  const [year, month] = issuanceDate.split("-").map(Number);
  const [currentYear, currentMonth] = currentIndiaDate.split("-").map(Number);
  const monthsEarlier = (currentYear - year) * 12 + currentMonth - month;
  if (monthsEarlier === 1) {
    return "Previous-month issuance after the 15th-day approval cutoff";
  }
  return "Older-month policy issuance outside the permitted direct-submission window";
}
