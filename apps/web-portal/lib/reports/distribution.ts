import "server-only";
import {
  getAccessibleIntermediaryApplicationIds,
  getAccessibleIntermediaryIds,
  getEmployeeAccessScope,
} from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile = { id: string; role: string | null };

export type DistributionQuery = {
  period?: string;
  from?: string;
  to?: string;
  rm?: string;
  type?: string;
  status?: string;
  page?: string;
  onboardingPage?: string;
};

export type DistributionFilters = {
  period: "90d" | "mtd" | "ytd" | "all" | "custom";
  fromDate: string | null;
  toDate: string | null;
  rmEmployeeId: string | null;
  intermediaryType: "partner" | "posp" | "misp" | null;
  accountStatus: string | null;
  page: number;
  onboardingPage: number;
};

export type DistributionReport = {
  summary: {
    intermediary_count: number;
    active_intermediary_count: number;
    partner_count: number;
    posp_count: number;
    misp_count: number;
    producing_intermediary_count: number;
    policy_count: number;
    customer_count: number;
    gross_premium: number;
    onboarding_open_count: number;
  };
  rms: Array<{
    employee_id: string | null;
    name: string;
    intermediary_count: number;
    active_intermediary_count: number;
    producing_intermediary_count: number;
    policy_count: number;
    customer_count: number;
    gross_premium: number;
  }>;
  intermediaries: {
    rows: Array<{
      id: string;
      application_id: string | null;
      code: string | null;
      name: string;
      type: string;
      rm_employee_id: string | null;
      rm_name: string;
      account_status: string;
      compliance_status: string;
      iib_status: string;
      registration_status: string | null;
      policy_count: number;
      customer_count: number;
      gross_premium: number;
      last_business_date: string | null;
    }>;
    total_count: number;
    page: number;
    page_size: number;
  };
  onboarding_summary: {
    total: number;
    open: number;
    compliance: number;
    training: number;
    exam: number;
    agreement: number;
    iib: number;
    completed: number;
    rejected: number;
  };
  onboarding: {
    rows: Array<{
      id: string;
      application_reference: string | null;
      name: string;
      type: string;
      rm_employee_id: string | null;
      rm_name: string;
      stage: string;
      registration_status: string;
      training_status: string | null;
      exam_status: string | null;
      agreement_status: string | null;
      iib_registration_status: string | null;
      age_days: number;
      submitted_at: string | null;
      completed_at: string | null;
    }>;
    total_count: number;
    page: number;
    page_size: number;
  };
  filters: {
    rms: Array<{ id: string; name: string }>;
    types: string[];
    account_statuses: string[];
  };
};

export async function loadDistributionReport(profile: ViewerProfile, query: DistributionQuery) {
  const filters = resolveDistributionFilters(query);
  const [intermediaryIds, applicationIds, scope] = await Promise.all([
    getAccessibleIntermediaryIds(profile.id, profile.role, "view_reports"),
    getAccessibleIntermediaryApplicationIds(profile.id, profile.role, "view_reports"),
    getEmployeeAccessScope(profile.id, profile.role, "view_reports"),
  ]);

  if (
    (intermediaryIds !== null && intermediaryIds.length === 0) &&
    (applicationIds !== null && applicationIds.length === 0)
  ) {
    return { report: emptyDistributionReport(filters.page, filters.onboardingPage), filters, scopeMode: scope.mode };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_distribution_report", {
    p_intermediary_ids: intermediaryIds,
    p_application_ids: applicationIds,
    p_from_date: filters.fromDate,
    p_to_date: filters.toDate,
    p_rm_employee_id: filters.rmEmployeeId,
    p_intermediary_type: filters.intermediaryType,
    p_account_status: filters.accountStatus,
    p_page: filters.page,
    p_page_size: 25,
    p_onboarding_page: filters.onboardingPage,
    p_onboarding_page_size: 25,
  });

  if (error) throw new Error(`Distribution report query failed: ${error.message}`);
  return { report: normalizeDistributionReport(data, filters.page, filters.onboardingPage), filters, scopeMode: scope.mode };
}

export function resolveDistributionFilters(query: DistributionQuery): DistributionFilters {
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
    rmEmployeeId: validUuid(query.rm),
    intermediaryType: isType(query.type) ? query.type : null,
    accountStatus: cleanText(query.status, 40),
    page: positiveInteger(query.page),
    onboardingPage: positiveInteger(query.onboardingPage),
  };
}

function normalizeDistributionReport(value: unknown, page: number, onboardingPage: number): DistributionReport {
  const raw = objectValue(value);
  const summary = objectValue(raw.summary);
  const intermediaries = objectValue(raw.intermediaries);
  const onboardingSummary = objectValue(raw.onboarding_summary);
  const onboarding = objectValue(raw.onboarding);
  const filters = objectValue(raw.filters);

  return {
    summary: {
      intermediary_count: numberValue(summary.intermediary_count),
      active_intermediary_count: numberValue(summary.active_intermediary_count),
      partner_count: numberValue(summary.partner_count),
      posp_count: numberValue(summary.posp_count),
      misp_count: numberValue(summary.misp_count),
      producing_intermediary_count: numberValue(summary.producing_intermediary_count),
      policy_count: numberValue(summary.policy_count),
      customer_count: numberValue(summary.customer_count),
      gross_premium: numberValue(summary.gross_premium),
      onboarding_open_count: numberValue(summary.onboarding_open_count),
    },
    rms: arrayValue(raw.rms).map((row) => {
      const item = objectValue(row);
      return {
        employee_id: nullableString(item.employee_id),
        name: stringValue(item.name),
        intermediary_count: numberValue(item.intermediary_count),
        active_intermediary_count: numberValue(item.active_intermediary_count),
        producing_intermediary_count: numberValue(item.producing_intermediary_count),
        policy_count: numberValue(item.policy_count),
        customer_count: numberValue(item.customer_count),
        gross_premium: numberValue(item.gross_premium),
      };
    }),
    intermediaries: {
      rows: arrayValue(intermediaries.rows).map((row) => {
        const item = objectValue(row);
        return {
          id: stringValue(item.id),
          application_id: nullableString(item.application_id),
          code: nullableString(item.code),
          name: stringValue(item.name),
          type: stringValue(item.type),
          rm_employee_id: nullableString(item.rm_employee_id),
          rm_name: stringValue(item.rm_name),
          account_status: stringValue(item.account_status),
          compliance_status: stringValue(item.compliance_status),
          iib_status: stringValue(item.iib_status),
          registration_status: nullableString(item.registration_status),
          policy_count: numberValue(item.policy_count),
          customer_count: numberValue(item.customer_count),
          gross_premium: numberValue(item.gross_premium),
          last_business_date: nullableString(item.last_business_date),
        };
      }),
      total_count: numberValue(intermediaries.total_count),
      page: numberValue(intermediaries.page) || page,
      page_size: numberValue(intermediaries.page_size) || 25,
    },
    onboarding_summary: {
      total: numberValue(onboardingSummary.total),
      open: numberValue(onboardingSummary.open),
      compliance: numberValue(onboardingSummary.compliance),
      training: numberValue(onboardingSummary.training),
      exam: numberValue(onboardingSummary.exam),
      agreement: numberValue(onboardingSummary.agreement),
      iib: numberValue(onboardingSummary.iib),
      completed: numberValue(onboardingSummary.completed),
      rejected: numberValue(onboardingSummary.rejected),
    },
    onboarding: {
      rows: arrayValue(onboarding.rows).map((row) => {
        const item = objectValue(row);
        return {
          id: stringValue(item.id),
          application_reference: nullableString(item.application_reference),
          name: stringValue(item.name),
          type: stringValue(item.type),
          rm_employee_id: nullableString(item.rm_employee_id),
          rm_name: stringValue(item.rm_name),
          stage: stringValue(item.stage),
          registration_status: stringValue(item.registration_status),
          training_status: nullableString(item.training_status),
          exam_status: nullableString(item.exam_status),
          agreement_status: nullableString(item.agreement_status),
          iib_registration_status: nullableString(item.iib_registration_status),
          age_days: numberValue(item.age_days),
          submitted_at: nullableString(item.submitted_at),
          completed_at: nullableString(item.completed_at),
        };
      }),
      total_count: numberValue(onboarding.total_count),
      page: numberValue(onboarding.page) || onboardingPage,
      page_size: numberValue(onboarding.page_size) || 25,
    },
    filters: {
      rms: arrayValue(filters.rms).map((row) => {
        const item = objectValue(row);
        return { id: stringValue(item.id), name: stringValue(item.name) };
      }).filter((row) => row.id && row.name),
      types: arrayValue(filters.types).map(stringValue).filter(Boolean),
      account_statuses: arrayValue(filters.account_statuses).map(stringValue).filter(Boolean),
    },
  };
}

function emptyDistributionReport(page: number, onboardingPage: number): DistributionReport {
  return {
    summary: {
      intermediary_count: 0,
      active_intermediary_count: 0,
      partner_count: 0,
      posp_count: 0,
      misp_count: 0,
      producing_intermediary_count: 0,
      policy_count: 0,
      customer_count: 0,
      gross_premium: 0,
      onboarding_open_count: 0,
    },
    rms: [],
    intermediaries: { rows: [], total_count: 0, page, page_size: 25 },
    onboarding_summary: { total: 0, open: 0, compliance: 0, training: 0, exam: 0, agreement: 0, iib: 0, completed: 0, rejected: 0 },
    onboarding: { rows: [], total_count: 0, page: onboardingPage, page_size: 25 },
    filters: { rms: [], types: ["partner", "posp", "misp"], account_statuses: ["active", "under_onboarding", "inactive", "suspended", "terminated", "rejected"] },
  };
}

function isPeriod(value: string | undefined): value is DistributionFilters["period"] {
  return value === "90d" || value === "mtd" || value === "ytd" || value === "all" || value === "custom";
}
function isType(value: string | undefined): value is NonNullable<DistributionFilters["intermediaryType"]> {
  return value === "partner" || value === "posp" || value === "misp";
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
