export type OperationalMetric = { key: string; label: string; value: number; href: string };
export type OperationalSummary = { metrics: OperationalMetric[]; asOf: string; scope: "organization" | "assigned" };
export interface OperationalSummaryRepository { summarize(query: string): Promise<OperationalSummary> }

export function isOperationalSummaryQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return /\b(how many|count|total|right now|currently|active|inactive|pending|open|overdue|expired|expiring|dashboard|overview|summary)\b/.test(normalized);
}
