import "server-only";
import { getAccessibleCustomerIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile = { id: string; role: string | null };

export type PolicyBusinessQuery = {
  period?: string;
  from?: string;
  to?: string;
  insurer?: string;
  rm?: string;
  intermediary?: string;
  page?: string;
};

export type PolicyBusinessFilters = {
  period: "90d" | "mtd" | "ytd" | "all" | "custom";
  fromDate: string | null;
  toDate: string | null;
  insurerId: string | null;
  rmName: string | null;
  intermediaryCode: string | null;
  page: number;
};

export type PolicyBusinessReport = {
  summary: {
    policy_count: number;
    active_policy_count: number;
    gross_premium: number;
    net_premium: number;
    od_premium: number;
    tp_premium: number;
    cpa_amount: number;
    average_premium: number;
    insurer_count: number;
    intermediary_count: number;
  };
  trend: Array<{ month: string; policy_count: number; gross_premium: number }>;
  insurers: Array<{ id: string; name: string; policy_count: number; gross_premium: number; share_percent: number }>;
  rms: Array<{ name: string; policy_count: number; intermediary_count: number; gross_premium: number; average_premium: number }>;
  filters: {
    insurers: Array<{ id: string; name: string }>;
    rms: string[];
    intermediaries: Array<{ code: string; type: string | null; name: string }>;
  };
  register: {
    rows: PolicyBusinessRow[];
    total_count: number;
    page: number;
    page_size: number;
  };
};

export type PolicyBusinessRow = {
  id: string;
  policy_no: string;
  business_date: string;
  policy_type: string;
  business_type: string | null;
  start_date: string;
  end_date: string;
  status: string;
  customer_name: string;
  customer_code: string;
  vehicle_no: string;
  insurer_name: string;
  rm_name: string | null;
  intermediary_code: string | null;
  intermediary_type: string | null;
  gross_premium: number;
  net_premium: number;
  od_premium: number;
  tp_premium: number;
  cpa_amount: number;
  insured_declared_value: number | null;
};

export async function loadPolicyBusinessReport(profile: ViewerProfile, query: PolicyBusinessQuery) {
  const filters = resolvePolicyBusinessFilters(query);
  const [customerIds, scope] = await Promise.all([
    getAccessibleCustomerIds(profile.id, profile.role, "view_reports"),
    getEmployeeAccessScope(profile.id, profile.role, "view_reports"),
  ]);

  if (customerIds !== null && customerIds.length === 0) {
    return { report: emptyPolicyBusinessReport(filters.page), filters, scopeMode: scope.mode };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_policy_business_report", {
    p_customer_ids: customerIds,
    p_from_date: filters.fromDate,
    p_to_date: filters.toDate,
    p_insurer_id: filters.insurerId,
    p_rm_name: filters.rmName,
    p_intermediary_code: filters.intermediaryCode,
    p_page: filters.page,
    p_page_size: 25,
  });

  if (error) throw new Error(`Policy business report query failed: ${error.message}`);
  return { report: normalizePolicyBusinessReport(data, filters.page), filters, scopeMode: scope.mode };
}

export function resolvePolicyBusinessFilters(query: PolicyBusinessQuery): PolicyBusinessFilters {
  const period = isPeriod(query.period) ? query.period : "90d";
  const today = indiaDate(new Date());
  const todayDate = new Date(`${today}T00:00:00+05:30`);

  let fromDate: string | null = null;
  let toDate: string | null = today;

  if (period === "90d") fromDate = indiaDate(addDays(todayDate, -89));
  if (period === "mtd") fromDate = `${today.slice(0, 8)}01`;
  if (period === "ytd") fromDate = `${today.slice(0, 4)}-01-01`;
  if (period === "all") toDate = null;
  if (period === "custom") {
    fromDate = validDate(query.from);
    toDate = validDate(query.to);
  }

  if (fromDate && toDate && fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];

  return {
    period,
    fromDate,
    toDate,
    insurerId: validUuid(query.insurer),
    rmName: cleanText(query.rm, 100),
    intermediaryCode: cleanText(query.intermediary, 120),
    page: positiveInteger(query.page),
  };
}

export function reportScopeLabel(mode: "organization" | "hierarchy" | "self" | "none") {
  if (mode === "organization") return "Organization";
  if (mode === "hierarchy") return "Reporting hierarchy";
  if (mode === "self") return "My portfolio";
  return "Assigned records";
}

function normalizePolicyBusinessReport(value: unknown, page: number): PolicyBusinessReport {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const summary = objectValue(raw.summary);
  const register = objectValue(raw.register);
  const filters = objectValue(raw.filters);

  return {
    summary: {
      policy_count: numberValue(summary.policy_count),
      active_policy_count: numberValue(summary.active_policy_count),
      gross_premium: numberValue(summary.gross_premium),
      net_premium: numberValue(summary.net_premium),
      od_premium: numberValue(summary.od_premium),
      tp_premium: numberValue(summary.tp_premium),
      cpa_amount: numberValue(summary.cpa_amount),
      average_premium: numberValue(summary.average_premium),
      insurer_count: numberValue(summary.insurer_count),
      intermediary_count: numberValue(summary.intermediary_count),
    },
    trend: arrayValue(raw.trend).map((row) => {
      const item = objectValue(row);
      return { month: stringValue(item.month), policy_count: numberValue(item.policy_count), gross_premium: numberValue(item.gross_premium) };
    }),
    insurers: arrayValue(raw.insurers).map((row) => {
      const item = objectValue(row);
      return { id: stringValue(item.id), name: stringValue(item.name), policy_count: numberValue(item.policy_count), gross_premium: numberValue(item.gross_premium), share_percent: numberValue(item.share_percent) };
    }),
    rms: arrayValue(raw.rms).map((row) => {
      const item = objectValue(row);
      return { name: stringValue(item.name), policy_count: numberValue(item.policy_count), intermediary_count: numberValue(item.intermediary_count), gross_premium: numberValue(item.gross_premium), average_premium: numberValue(item.average_premium) };
    }),
    filters: {
      insurers: arrayValue(filters.insurers).map((row) => {
        const item = objectValue(row); return { id: stringValue(item.id), name: stringValue(item.name) };
      }),
      rms: arrayValue(filters.rms).map((value) => stringValue(value)).filter(Boolean),
      intermediaries: arrayValue(filters.intermediaries).map((row) => {
        const item = objectValue(row); return { code: stringValue(item.code), type: nullableString(item.type), name: stringValue(item.name) };
      }),
    },
    register: {
      rows: arrayValue(register.rows).map(normalizeRow),
      total_count: numberValue(register.total_count),
      page: numberValue(register.page) || page,
      page_size: numberValue(register.page_size) || 25,
    },
  };
}

function normalizeRow(row: unknown): PolicyBusinessRow {
  const item = objectValue(row);
  return {
    id: stringValue(item.id), policy_no: stringValue(item.policy_no), business_date: stringValue(item.business_date),
    policy_type: stringValue(item.policy_type), business_type: nullableString(item.business_type), start_date: stringValue(item.start_date),
    end_date: stringValue(item.end_date), status: stringValue(item.status), customer_name: stringValue(item.customer_name),
    customer_code: stringValue(item.customer_code), vehicle_no: stringValue(item.vehicle_no), insurer_name: stringValue(item.insurer_name),
    rm_name: nullableString(item.rm_name), intermediary_code: nullableString(item.intermediary_code), intermediary_type: nullableString(item.intermediary_type),
    gross_premium: numberValue(item.gross_premium), net_premium: numberValue(item.net_premium), od_premium: numberValue(item.od_premium),
    tp_premium: numberValue(item.tp_premium), cpa_amount: numberValue(item.cpa_amount), insured_declared_value: nullableNumber(item.insured_declared_value),
  };
}

function emptyPolicyBusinessReport(page: number): PolicyBusinessReport {
  return {
    summary: { policy_count: 0, active_policy_count: 0, gross_premium: 0, net_premium: 0, od_premium: 0, tp_premium: 0, cpa_amount: 0, average_premium: 0, insurer_count: 0, intermediary_count: 0 },
    trend: [], insurers: [], rms: [], filters: { insurers: [], rms: [], intermediaries: [] },
    register: { rows: [], total_count: 0, page, page_size: 25 },
  };
}

function isPeriod(value: string | undefined): value is PolicyBusinessFilters["period"] {
  return value === "90d" || value === "mtd" || value === "ytd" || value === "all" || value === "custom";
}
function validDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function validUuid(value: string | undefined) { return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }
function cleanText(value: string | undefined, max: number) { const cleaned = value?.trim(); return cleaned ? cleaned.slice(0, max) : null; }
function positiveInteger(value: string | undefined) { const parsed = Number.parseInt(value ?? "1", 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : 1; }
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function indiaDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function nullableString(value: unknown) { const valueString = stringValue(value).trim(); return valueString || null; }
function numberValue(value: unknown) { const numeric = typeof value === "number" ? value : Number(value ?? 0); return Number.isFinite(numeric) ? numeric : 0; }
function nullableNumber(value: unknown) { if (value == null || value === "") return null; return numberValue(value); }
