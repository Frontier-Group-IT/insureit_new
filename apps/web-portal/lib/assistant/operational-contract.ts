export type OperationalMetric = { key: string; label: string; value: number; href: string };
export type OperationalSummary = { metrics: OperationalMetric[]; asOf: string; scope: "organization" | "assigned" };
export interface OperationalSummaryRepository { summarize(query: string): Promise<OperationalSummary> }
export type CustomerCategory = "group" | "corporate" | "dealership" | "individual_proprietor";

export function isOperationalSummaryQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return /\b(how many|count|total|right now|currently|active|inactive|pending|open|overdue|expired|expiring|dashboard|overview|summary)\b/.test(normalized);
}

export function classifyCustomerCategory(query: string): CustomerCategory | null {
  const normalized = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (/\bgroup\b/.test(normalized)) return "group";
  if (/\bcorporate\b/.test(normalized)) return "corporate";
  if (/\bdealership\b/.test(normalized)) return "dealership";
  if (/\b(individual|proprietor)\b/.test(normalized)) return "individual_proprietor";
  return null;
}
