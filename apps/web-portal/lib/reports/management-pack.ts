import "server-only";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { loadClaimsReport } from "@/lib/reports/claims";
import { loadDistributionReport } from "@/lib/reports/distribution";
import { loadFinanceReport } from "@/lib/reports/finance";
import { loadGovernanceReport } from "@/lib/reports/governance";
import { loadOperationsReport } from "@/lib/reports/operations";
import { loadPolicyBusinessReport } from "@/lib/reports/policy-business";
import { loadRenewalReport } from "@/lib/reports/renewals";

type ViewerProfile = { id: string; role: string | null };
export type ManagementPackQuery = { month?: string };
export type ManagementPackFilters = { month: string; fromDate: string; toDate: string; currentMonth: string };

export type ManagementPack = {
  filters: ManagementPackFilters;
  scopeMode: "organization" | "hierarchy" | "self" | "none";
  canViewGovernance: boolean;
  business: Awaited<ReturnType<typeof loadPolicyBusinessReport>>["report"];
  distribution: Awaited<ReturnType<typeof loadDistributionReport>>["report"];
  finance: Awaited<ReturnType<typeof loadFinanceReport>>["report"];
  claims: Awaited<ReturnType<typeof loadClaimsReport>>["report"];
  renewals: Awaited<ReturnType<typeof loadRenewalReport>>["report"];
  operations: Awaited<ReturnType<typeof loadOperationsReport>>["report"];
  governance: Awaited<ReturnType<typeof loadGovernanceReport>>["report"] | null;
};

export async function loadManagementPack(profile: ViewerProfile, query: ManagementPackQuery): Promise<ManagementPack> {
  if (profile.role === "backoffice_executive") {
    throw new Error("Backoffice Executive cannot access management-pack finance, payout or governance data.");
  }
  const filters = resolveManagementPackFilters(query);
  const monthQuery = { period: "custom", from: filters.fromDate, to: filters.toDate, page: "1" };
  const canViewGovernance = await hasEffectiveCapability(profile, "manage_users");

  const [businessPayload, distributionPayload, financePayload, claimsPayload, renewalsPayload, operationsPayload, governancePayload] = await Promise.all([
    loadPolicyBusinessReport(profile, monthQuery),
    loadDistributionReport(profile, { ...monthQuery, onboardingPage: "1" }),
    loadFinanceReport(profile, monthQuery),
    loadClaimsReport(profile, monthQuery),
    loadRenewalReport(profile, { horizon: "90", page: "1" }),
    loadOperationsReport(profile, { horizon: "90", page: "1" }),
    canViewGovernance ? loadGovernanceReport({ period: "custom", from: filters.fromDate, to: filters.toDate, page: "1" }) : Promise.resolve(null),
  ]);

  return {
    filters,
    scopeMode: businessPayload.scopeMode,
    canViewGovernance,
    business: businessPayload.report,
    distribution: distributionPayload.report,
    finance: financePayload.report,
    claims: claimsPayload.report,
    renewals: renewalsPayload.report,
    operations: operationsPayload.report,
    governance: governancePayload?.report ?? null,
  };
}

export function resolveManagementPackFilters(query: ManagementPackQuery): ManagementPackFilters {
  const today = indiaDate(new Date());
  const currentMonth = today.slice(0, 7);
  const requested = validMonth(query.month) && query.month! <= currentMonth ? query.month! : currentMonth;
  const fromDate = `${requested}-01`;
  const lastDay = lastDayOfMonth(requested);
  const toDate = requested === currentMonth ? today : lastDay;
  return { month: requested, fromDate, toDate, currentMonth };
}

export function managementPackCsvRows(pack: ManagementPack) {
  const rows: Array<[string, string, string | number]> = [];
  const add = (section: string, metric: string, value: string | number) => rows.push([section, metric, value]);

  add("Business", "Policies", pack.business.summary.policy_count);
  add("Business", "Active policies", pack.business.summary.active_policy_count);
  add("Business", "Gross premium", pack.business.summary.gross_premium);
  add("Business", "Net premium", pack.business.summary.net_premium);
  add("Business", "Average premium", pack.business.summary.average_premium);
  add("Business", "Intermediaries", pack.business.summary.intermediary_count);

  add("Distribution", "Active intermediaries", pack.distribution.summary.active_intermediary_count);
  add("Distribution", "Producing intermediaries", pack.distribution.summary.producing_intermediary_count);
  add("Distribution", "Customers", pack.distribution.summary.customer_count);
  add("Distribution", "Policies", pack.distribution.summary.policy_count);
  add("Distribution", "Gross premium", pack.distribution.summary.gross_premium);
  add("Distribution", "Open onboarding", pack.distribution.summary.onboarding_open_count);

  add("Finance", "Projected PayIn", pack.finance.summary.projected_payin);
  add("Finance", "PayIn after TDS", pack.finance.summary.payin_after_tds);
  add("Finance", "Billed", pack.finance.summary.billed_amount);
  add("Finance", "Partner payout", pack.finance.summary.gross_payout);
  add("Finance", "Retention", pack.finance.summary.retention_amount);
  add("Finance", "Billing incomplete", pack.finance.summary.billing_incomplete_count);
  add("Finance", "Pending payout", pack.finance.summary.pending_payout_count);

  add("Claims", "Claims", pack.claims.summary.claim_count);
  add("Claims", "Open claims", pack.claims.summary.open_claim_count);
  add("Claims", "Settled claims", pack.claims.summary.settled_claim_count);
  add("Claims", "Estimated loss", pack.claims.summary.estimated_loss);
  add("Claims", "Settlement amount", pack.claims.summary.settlement_amount);

  add("Renewal snapshot", "Due within 30 days", pack.renewals.summary.due_30_count);
  add("Renewal snapshot", "Due within 90 days", pack.renewals.summary.due_90_count);
  add("Renewal snapshot", "Premium at risk", pack.renewals.summary.premium_at_risk);
  add("Renewal snapshot", "Nearest expiry", pack.renewals.summary.nearest_expiry ?? "");

  add("Operations snapshot", "Vehicles", pack.operations.summary.vehicle_count);
  add("Operations snapshot", "AuthBridge unverified", pack.operations.summary.authbridge_unverified_count);
  add("Operations snapshot", "Missing compliance fields", pack.operations.summary.missing_compliance_fields);
  add("Operations snapshot", "Expired documents", pack.operations.summary.expired_document_count);
  add("Operations snapshot", "Due within 90 days", pack.operations.summary.due_document_count);

  if (pack.governance) {
    add("Governance", "Active profiles", pack.governance.summary.active_profile_count);
    add("Governance", "Inactive profiles", pack.governance.summary.inactive_profile_count);
    add("Governance", "Active employee overrides", pack.governance.summary.active_employee_override_count);
    add("Governance", "Permission changes", pack.governance.summary.permission_change_count);
    add("Governance", "Audit events", pack.governance.summary.audit_event_count);
  }
  return rows;
}

function validMonth(value: string | undefined) { return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)); }
function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
