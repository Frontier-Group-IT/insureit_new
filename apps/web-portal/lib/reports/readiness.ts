import "server-only";
import { getAccessibleCustomerIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile = { id: string; role: string | null };
export type ReadinessDomain = "all" | "vehicle" | "policy_finance" | "claim" | "customer";
export type ReportingReadinessQuery = { domain?: string; page?: string };
export type ReportingReadinessFilters = { domain: ReadinessDomain; page: number };

export type ReportingReadinessSummary = {
  exception_records: number;
  critical_records: number;
  warning_records: number;
  attention_records: number;
  vehicle_records: number;
  vehicles_missing_compliance: number;
  missing_compliance_fields: number;
  expired_compliance_fields: number;
  due_30_compliance_fields: number;
  authbridge_unverified: number;
  registration_pending: number;
  policy_finance_records: number;
  policy_missing_insurer: number;
  policy_missing_premium: number;
  policy_unassigned_rm: number;
  finance_missing_payin: number;
  billing_incomplete: number;
  unbilled: number;
  pending_payout: number;
  negative_retention: number;
  claim_records: number;
  claim_pending_documents: number;
  claim_rejected_documents: number;
  customer_records: number;
  customer_pending_documents: number;
  customer_rejected_documents: number;
  workflow_backlog: number;
};

export type ReportingReadinessRow = {
  domain: Exclude<ReadinessDomain, "all">;
  entity_id: string;
  customer_id: string;
  primary_label: string;
  secondary_label: string;
  issue_count: number;
  issue_labels: string[];
  severity: "critical" | "warning" | "attention";
  action_path: string;
};

export type ReportingReadinessReport = {
  summary: ReportingReadinessSummary;
  domains: Array<{ domain: Exclude<ReadinessDomain, "all">; label: string; exception_records: number; sort_order: number }>;
  register: { rows: ReportingReadinessRow[]; total_count: number; page: number; page_size: number };
};

export async function loadReportingReadiness(profile: ViewerProfile, query: ReportingReadinessQuery, pageSize = 25) {
  const filters = resolveReportingReadinessFilters(query);
  const [customerIds, scope] = await Promise.all([
    getAccessibleCustomerIds(profile.id, profile.role, "view_reports"),
    getEmployeeAccessScope(profile.id, profile.role, "view_reports"),
  ]);

  if (customerIds !== null && customerIds.length === 0) {
    return { report: emptyReadinessReport(filters.page, pageSize), filters, scopeMode: scope.mode };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_reporting_readiness_report", {
    p_customer_ids: customerIds,
    p_domain: filters.domain,
    p_page: filters.page,
    p_page_size: Math.min(Math.max(pageSize, 1), 100),
  });
  if (error) throw new Error(`Reporting readiness query failed: ${error.message}`);
  return { report: normalizeReport(data, filters.page, pageSize), filters, scopeMode: scope.mode };
}

export async function loadReportingReadinessExport(profile: ViewerProfile, domain: ReadinessDomain) {
  const first = await loadReportingReadiness(profile, { domain, page: "1" }, 100);
  const rows = [...first.report.register.rows];
  const total = first.report.register.total_count;
  const maxRows = 10000;
  if (total > maxRows) return { ...first, rows, truncated: true };
  const pages = Math.ceil(total / 100);
  for (let page = 2; page <= pages; page += 1) {
    const payload = await loadReportingReadiness(profile, { domain, page: String(page) }, 100);
    rows.push(...payload.report.register.rows);
  }
  return { ...first, rows, truncated: false };
}

export function resolveReportingReadinessFilters(query: ReportingReadinessQuery): ReportingReadinessFilters {
  return { domain: isDomain(query.domain) ? query.domain : "all", page: positiveInteger(query.page) };
}

function normalizeReport(value: unknown, page: number, pageSize: number): ReportingReadinessReport {
  const raw = objectValue(value);
  const summary = objectValue(raw.summary);
  const register = objectValue(raw.register);
  return {
    summary: {
      exception_records: numberValue(summary.exception_records), critical_records: numberValue(summary.critical_records), warning_records: numberValue(summary.warning_records), attention_records: numberValue(summary.attention_records),
      vehicle_records: numberValue(summary.vehicle_records), vehicles_missing_compliance: numberValue(summary.vehicles_missing_compliance), missing_compliance_fields: numberValue(summary.missing_compliance_fields), expired_compliance_fields: numberValue(summary.expired_compliance_fields), due_30_compliance_fields: numberValue(summary.due_30_compliance_fields), authbridge_unverified: numberValue(summary.authbridge_unverified), registration_pending: numberValue(summary.registration_pending),
      policy_finance_records: numberValue(summary.policy_finance_records), policy_missing_insurer: numberValue(summary.policy_missing_insurer), policy_missing_premium: numberValue(summary.policy_missing_premium), policy_unassigned_rm: numberValue(summary.policy_unassigned_rm), finance_missing_payin: numberValue(summary.finance_missing_payin), billing_incomplete: numberValue(summary.billing_incomplete), unbilled: numberValue(summary.unbilled), pending_payout: numberValue(summary.pending_payout), negative_retention: numberValue(summary.negative_retention),
      claim_records: numberValue(summary.claim_records), claim_pending_documents: numberValue(summary.claim_pending_documents), claim_rejected_documents: numberValue(summary.claim_rejected_documents), customer_records: numberValue(summary.customer_records), customer_pending_documents: numberValue(summary.customer_pending_documents), customer_rejected_documents: numberValue(summary.customer_rejected_documents), workflow_backlog: numberValue(summary.workflow_backlog),
    },
    domains: arrayValue(raw.domains).map((row) => {
      const item = objectValue(row);
      return { domain: normalizeDomain(item.domain), label: stringValue(item.label), exception_records: numberValue(item.exception_records), sort_order: numberValue(item.sort_order) };
    }),
    register: {
      rows: arrayValue(register.rows).map((row) => {
        const item = objectValue(row);
        return {
          domain: normalizeDomain(item.domain), entity_id: stringValue(item.entity_id), customer_id: stringValue(item.customer_id), primary_label: stringValue(item.primary_label), secondary_label: stringValue(item.secondary_label), issue_count: numberValue(item.issue_count), issue_labels: arrayValue(item.issue_labels).map(stringValue).filter(Boolean), severity: normalizeSeverity(item.severity), action_path: stringValue(item.action_path),
        };
      }),
      total_count: numberValue(register.total_count), page: numberValue(register.page) || page, page_size: numberValue(register.page_size) || pageSize,
    },
  };
}

export function emptyReadinessReport(page: number, pageSize: number): ReportingReadinessReport {
  return {
    summary: { exception_records:0,critical_records:0,warning_records:0,attention_records:0,vehicle_records:0,vehicles_missing_compliance:0,missing_compliance_fields:0,expired_compliance_fields:0,due_30_compliance_fields:0,authbridge_unverified:0,registration_pending:0,policy_finance_records:0,policy_missing_insurer:0,policy_missing_premium:0,policy_unassigned_rm:0,finance_missing_payin:0,billing_incomplete:0,unbilled:0,pending_payout:0,negative_retention:0,claim_records:0,claim_pending_documents:0,claim_rejected_documents:0,customer_records:0,customer_pending_documents:0,customer_rejected_documents:0,workflow_backlog:0 },
    domains: [], register: { rows: [], total_count: 0, page, page_size: pageSize },
  };
}

function isDomain(value: string | undefined): value is ReadinessDomain { return value === "all" || value === "vehicle" || value === "policy_finance" || value === "claim" || value === "customer"; }
function normalizeDomain(value: unknown): Exclude<ReadinessDomain, "all"> { const text=stringValue(value); return text === "policy_finance" || text === "claim" || text === "customer" ? text : "vehicle"; }
function normalizeSeverity(value: unknown): ReportingReadinessRow["severity"] { const text=stringValue(value); return text === "critical" || text === "attention" ? text : "warning"; }
function positiveInteger(value: string | undefined) { const parsed = Number.parseInt(value ?? "1",10); return Number.isFinite(parsed) && parsed > 0 ? parsed : 1; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function numberValue(value: unknown) { const numeric = typeof value === "number" ? value : Number(value ?? 0); return Number.isFinite(numeric) ? numeric : 0; }
