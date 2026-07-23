import type { SupabaseClient } from "@supabase/supabase-js";

type RecentApplication = {
  id: string;
  partner_type: string | null;
  status: string;
  applicant_phone: string | null;
  applicant_email: string | null;
  display_name: string | null;
  updated_at: string;
};

type FallbackApplication = Omit<RecentApplication, "display_name"> & {
  draft_data: Record<string, unknown> | null;
};

type RecentClaim = {
  id: string;
  claim_no: string;
  current_status: string;
  updated_at: string;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
};

export type OperationsDashboardData = {
  totals: {
    customers: number;
    activeCustomers: number;
    newCustomers: number;
    vehicles: number;
    policies: number;
    activePolicies: number;
    expiringPolicies: number;
    expiredPolicies: number;
    claims: number;
    openClaims: number;
    recentClaims: number;
  };
  portfolio: Array<{ key: string; label: string; value: number }>;
  attention: {
    onboarding: number;
    submittedOnboarding: number;
    changesRequested: number;
    overdueTasks: number;
    openTasks: number;
    documents: number;
    highPriorityActivity: number;
  };
  recentApplications: RecentApplication[];
  latestClaims: RecentClaim[];
  errors: string[];
};

const closedClaimStatuses = ["Claim Complete", "Settled", "Closed"];
const openTaskStatuses = ["open", "in_progress"];
const activeOnboardingStatuses = ["submitted", "under_review", "changes_requested"];

export async function getOperationsDashboardData(supabase: SupabaseClient): Promise<OperationsDashboardData> {
  const rpcResult = await supabase.rpc("get_operations_dashboard");
  const rpcDashboard = normalizeRpcDashboard(rpcResult.data);
  if (!rpcResult.error && rpcDashboard) return rpcDashboard;

  const rpcWarning = rpcResult.error && !isMissingDashboardRpc(rpcResult.error)
    ? "The optimized dashboard service is unavailable; live fallback data is shown."
    : !rpcResult.error
      ? "The optimized dashboard service returned an invalid response; live fallback data is shown."
      : null;

  return getOperationsDashboardFallback(supabase, rpcWarning);
}

async function getOperationsDashboardFallback(supabase: SupabaseClient, rpcWarning: string | null): Promise<OperationsDashboardData> {
  const today = dateKey(new Date());
  const in45Days = dateKey(addDays(new Date(), 45));
  const in30DaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const results = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("onboarding_status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", in30DaysAgo),
    countCustomersByPartner(supabase, "group"),
    countCustomersByPartner(supabase, "corporate"),
    countCustomersByPartner(supabase, "dealership"),
    countCustomersByPartner(supabase, "individual_proprietor"),
    countCustomersByPartner(supabase, "posp"),
    countCustomersByPartner(supabase, "misp"),
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("policies").select("id", { count: "exact", head: true }),
    supabase.from("policies").select("id", { count: "exact", head: true }).gte("end_date", today),
    supabase.from("policies").select("id", { count: "exact", head: true }).gte("end_date", today).lte("end_date", in45Days),
    supabase.from("policies").select("id", { count: "exact", head: true }).lt("end_date", today),
    supabase.from("claims").select("id", { count: "exact", head: true }),
    supabase.from("claims").select("id", { count: "exact", head: true }).in("current_status", closedClaimStatuses),
    supabase.from("claims").select("id", { count: "exact", head: true }).gte("created_at", in30DaysAgo),
    supabase.from("claim_tasks").select("id", { count: "exact", head: true }).in("status", openTaskStatuses),
    supabase.from("claim_tasks").select("id", { count: "exact", head: true }).in("status", openTaskStatuses).lt("due_date", today),
    supabase.from("customer_onboarding_applications").select("id", { count: "exact", head: true }).in("status", activeOnboardingStatuses),
    supabase.from("customer_onboarding_applications").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("customer_onboarding_applications").select("id", { count: "exact", head: true }).eq("status", "changes_requested"),
    supabase.from("claim_documents").select("id", { count: "exact", head: true }).in("verification_status", ["pending", "rejected"]),
    supabase.from("customer_onboarding_documents").select("id", { count: "exact", head: true }).in("verification_status", ["pending", "rejected"]),
    supabase.from("customer_activity_events").select("id", { count: "exact", head: true }).in("status", ["new", "seen", "in_progress"]).in("priority", ["high", "critical"]),
    supabase
      .from("customer_onboarding_applications")
      .select("id, partner_type, status, applicant_phone, applicant_email, draft_data, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5)
      .returns<FallbackApplication[]>(),
    supabase
      .from("claims")
      .select("id, claim_no, current_status, updated_at, customers(company_name, contact_name), vehicles(vehicle_no)")
      .order("updated_at", { ascending: false })
      .limit(5)
      .returns<RecentClaim[]>()
  ]);

  const [
    customers,
    activeCustomers,
    newCustomers,
    groups,
    corporate,
    dealerships,
    individuals,
    posp,
    misp,
    vehicles,
    policies,
    activePolicies,
    expiringPolicies,
    expiredPolicies,
    claims,
    closedClaims,
    recentClaims,
    openTasks,
    overdueTasks,
    onboarding,
    submittedOnboarding,
    changesRequested,
    claimDocuments,
    onboardingDocuments,
    highPriorityActivity,
    recentApplications,
    latestClaims
  ] = results;

  const errors = results
    .map((result, index) => result.error ? `${queryLabels[index]} could not be loaded.` : null)
    .filter(Boolean) as string[];

  return {
    totals: {
      customers: count(customers),
      activeCustomers: count(activeCustomers),
      newCustomers: count(newCustomers),
      vehicles: count(vehicles),
      policies: count(policies),
      activePolicies: count(activePolicies),
      expiringPolicies: count(expiringPolicies),
      expiredPolicies: count(expiredPolicies),
      claims: count(claims),
      openClaims: Math.max(count(claims) - count(closedClaims), 0),
      recentClaims: count(recentClaims)
    },
    portfolio: [
      { key: "group", label: "Groups", value: count(groups) },
      { key: "corporate", label: "Corporate", value: count(corporate) },
      { key: "dealership", label: "Dealerships", value: count(dealerships) },
      { key: "individual", label: "Individual / Proprietor", value: count(individuals) },
      { key: "posp", label: "POSP", value: count(posp) },
      { key: "misp", label: "MISP", value: count(misp) }
    ],
    attention: {
      onboarding: count(onboarding),
      submittedOnboarding: count(submittedOnboarding),
      changesRequested: count(changesRequested),
      overdueTasks: count(overdueTasks),
      openTasks: count(openTasks),
      documents: count(claimDocuments) + count(onboardingDocuments),
      highPriorityActivity: count(highPriorityActivity)
    },
    recentApplications: (recentApplications.data ?? []).map((application) => ({
      id: application.id,
      partner_type: application.partner_type,
      status: application.status,
      applicant_phone: application.applicant_phone,
      applicant_email: application.applicant_email,
      display_name: applicationDisplayName(application.partner_type, application.draft_data),
      updated_at: application.updated_at
    })),
    latestClaims: latestClaims.data ?? [],
    errors: rpcWarning ? [rpcWarning, ...errors] : errors
  };
}

function isMissingDashboardRpc(error: { code?: string; message?: string }) {
  return error.code === "PGRST202"
    || error.message?.toLowerCase().includes("schema cache") === true;
}

function normalizeRpcDashboard(value: unknown): OperationsDashboardData | null {
  const root = record(value);
  const totals = record(root?.totals);
  const attention = record(root?.attention);
  const portfolio = Array.isArray(root?.portfolio) ? root.portfolio : null;
  const applications = Array.isArray(root?.recentApplications) ? root.recentApplications : null;
  const claims = Array.isArray(root?.latestClaims) ? root.latestClaims : null;
  if (!root || !totals || !attention || !portfolio || !applications || !claims) return null;

  return {
    totals: {
      customers: number(totals.customers),
      activeCustomers: number(totals.activeCustomers),
      newCustomers: number(totals.newCustomers),
      vehicles: number(totals.vehicles),
      policies: number(totals.policies),
      activePolicies: number(totals.activePolicies),
      expiringPolicies: number(totals.expiringPolicies),
      expiredPolicies: number(totals.expiredPolicies),
      claims: number(totals.claims),
      openClaims: number(totals.openClaims),
      recentClaims: number(totals.recentClaims)
    },
    portfolio: portfolio.map((item) => {
      const row = record(item);
      return { key: text(row?.key) ?? "unknown", label: text(row?.label) ?? "Unknown", value: number(row?.value) };
    }),
    attention: {
      onboarding: number(attention.onboarding),
      submittedOnboarding: number(attention.submittedOnboarding),
      changesRequested: number(attention.changesRequested),
      overdueTasks: number(attention.overdueTasks),
      openTasks: number(attention.openTasks),
      documents: number(attention.documents),
      highPriorityActivity: number(attention.highPriorityActivity)
    },
    recentApplications: applications.flatMap((item) => {
      const row = record(item);
      const id = text(row?.id);
      const status = text(row?.status);
      const updatedAt = text(row?.updated_at);
      if (!id || !status || !updatedAt) return [];
      return [{
        id,
        partner_type: text(row?.partner_type),
        status,
        applicant_phone: text(row?.applicant_phone),
        applicant_email: text(row?.applicant_email),
        display_name: text(row?.display_name),
        updated_at: updatedAt
      }];
    }),
    latestClaims: claims.flatMap((item) => {
      const row = record(item);
      const customer = record(row?.customers);
      const vehicle = record(row?.vehicles);
      const id = text(row?.id);
      const claimNo = text(row?.claim_no);
      const status = text(row?.current_status);
      const updatedAt = text(row?.updated_at);
      if (!id || !claimNo || !status || !updatedAt) return [];
      return [{
        id,
        claim_no: claimNo,
        current_status: status,
        updated_at: updatedAt,
        customers: customer ? {
          company_name: text(customer.company_name),
          contact_name: text(customer.contact_name) ?? "Customer"
        } : null,
        vehicles: vehicle ? { vehicle_no: text(vehicle.vehicle_no) ?? "-" } : null
      }];
    }),
    errors: []
  };
}

function countCustomersByPartner(supabase: SupabaseClient, partnerType: string) {
  return supabase.from("customers").select("id", { count: "exact", head: true }).eq("partner_type", partnerType);
}

function count(result: { count: number | null }) {
  return result.count ?? 0;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function applicationDisplayName(partnerType: string | null, draft: Record<string, unknown> | null) {
  const data = draft ?? {};
  const candidates = partnerType === "group"
    ? [data.group_name, data.owner_name]
    : partnerType === "corporate"
      ? [data.company_name, data.contact_name]
      : partnerType === "dealership"
        ? [data.dealership_name, data.owner_name]
        : partnerType === "posp"
          ? [data.pos_name, data.associate_name]
          : partnerType === "misp"
            ? [data.misp_name, data.dp_name]
            : [data.contact_name, data.owner_name];
  const displayName = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof displayName === "string" ? displayName.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

const queryLabels = [
  "Customer total",
  "Active customers",
  "New customers",
  "Group portfolio",
  "Corporate portfolio",
  "Dealership portfolio",
  "Individual portfolio",
  "POSP portfolio",
  "MISP portfolio",
  "Fleet total",
  "Policy total",
  "Active policies",
  "Upcoming renewals",
  "Expired policies",
  "Claim total",
  "Closed claims",
  "Recent claims",
  "Open tasks",
  "Overdue tasks",
  "Onboarding queue",
  "Submitted onboarding",
  "Applications needing changes",
  "Claim documents",
  "Onboarding documents",
  "High-priority activity",
  "Recent applications",
  "Latest claims"
];
