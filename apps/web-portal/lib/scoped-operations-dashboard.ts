import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { OperationsDashboardData } from "@/lib/operations-dashboard";
import { loadScopedDashboardRows } from "@/lib/dashboard-scoped-query-batches";

const closedClaimStatuses = ["Claim Complete", "Settled", "Closed"];
const openTaskStatuses = ["open", "in_progress"];

export async function getScopedOperationsDashboardData(customerIds: string[]): Promise<OperationsDashboardData> {
  if (!customerIds.length) return emptyDashboard();

  const admin = createSupabaseAdminClient();
  const today = dateKey(new Date());
  const in45Days = dateKey(addDays(new Date(), 45));
  const in30DaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [customersResult, claimsResult] = await Promise.all([
    loadScopedDashboardRows(customerIds, (batch, from, to) => admin
      .from("customers")
      .select("id,onboarding_status,created_at,partner_type")
      .in("id", batch)
      .order("id", { ascending: true })
      .range(from, to)
      .returns<Array<{ id: string; onboarding_status: string | null; created_at: string; partner_type: string | null }>>()),
    loadScopedDashboardRows(customerIds, (batch, from, to) => admin
      .from("claims")
      .select("id,claim_no,current_status,created_at,updated_at,customer_id,customers(company_name,contact_name),vehicles(vehicle_no)")
      .in("customer_id", batch)
      .order("id", { ascending: true })
      .range(from, to)
      .returns<Array<{
        id: string; claim_no: string; current_status: string; created_at: string;
        updated_at: string; customer_id: string;
        customers: { company_name: string | null; contact_name: string } | null;
        vehicles: { vehicle_no: string } | null;
      }>>()),
  ]);
  const { data: customers, error: customersError } = customersResult;
  const { data: claims, error: claimsError } = claimsResult;
  const claimIds = (claims ?? []).map((claim) => claim.id);
  const scopedCustomerIds = (customers ?? []).map((customer) => customer.id);

  const [vehicles, policies, claimTasks, claimDocuments, activity] = await Promise.all([
    loadScopedDashboardRows(scopedCustomerIds, (batch, from, to) => admin
      .from("vehicles").select("id").in("customer_id", batch).order("id").range(from, to)
      .returns<Array<{ id: string }>>()),
    loadScopedDashboardRows(scopedCustomerIds, (batch, from, to) => admin
      .from("policies").select("id,end_date").in("customer_id", batch).order("id").range(from, to)
      .returns<Array<{ id: string; end_date: string }>>()),
    loadScopedDashboardRows(claimIds, (batch, from, to) => admin
      .from("claim_tasks").select("id,status,due_date").in("claim_id", batch).order("id").range(from, to)
      .returns<Array<{ id: string; status: string; due_date: string | null }>>()),
    loadScopedDashboardRows(scopedCustomerIds, (batch, from, to) => admin
      .from("claim_documents").select("id,verification_status")
      .in("customer_id", batch).in("verification_status", ["pending", "rejected"])
      .order("id").range(from, to)
      .returns<Array<{ id: string; verification_status: string }>>()),
    loadScopedDashboardRows(scopedCustomerIds, (batch, from, to) => admin
      .from("customer_activity_events").select("id")
      .in("customer_id", batch).in("status", ["new", "seen", "in_progress"])
      .in("priority", ["high", "critical"]).order("id").range(from, to)
      .returns<Array<{ id: string }>>()),
  ]);

  const errors = [
    customersError ? "Customer portfolio could not be loaded." : null,
    claimsError ? "Claim portfolio could not be loaded." : null,
    vehicles.error ? "Fleet total could not be loaded." : null,
    policies.error ? "Policy totals could not be loaded." : null,
    claimTasks.error ? "Claim task totals could not be loaded." : null,
    claimDocuments.error ? "Claim document totals could not be loaded." : null,
    activity.error ? "Customer activity totals could not be loaded." : null,
  ].filter(Boolean) as string[];

  const customerRows = customers ?? [];
  const policyRows = policies.data ?? [];
  const claimRows = claims ?? [];
  const taskRows = claimTasks.data ?? [];

  const activePolicies = policyRows.filter((policy) => policy.end_date >= today).length;
  const expiringPolicies = policyRows.filter((policy) => policy.end_date >= today && policy.end_date <= in45Days).length;
  const expiredPolicies = policyRows.filter((policy) => policy.end_date < today).length;
  const closedClaims = claimRows.filter((claim) => closedClaimStatuses.includes(claim.current_status)).length;

  const portfolioCounts = new Map<string, number>();
  for (const customer of customerRows) {
    const key = customer.partner_type === "individual_proprietor" ? "individual" : customer.partner_type ?? "unknown";
    portfolioCounts.set(key, (portfolioCounts.get(key) ?? 0) + 1);
  }

  return {
    totals: {
      customers: customerRows.length,
      activeCustomers: customerRows.filter((customer) => customer.onboarding_status === "active").length,
      newCustomers: customerRows.filter((customer) => Date.parse(customer.created_at) >= Date.parse(in30DaysAgo)).length,
      vehicles: vehicles.data?.length ?? 0,
      policies: policyRows.length,
      activePolicies,
      expiringPolicies,
      expiredPolicies,
      claims: claimRows.length,
      openClaims: Math.max(claimRows.length - closedClaims, 0),
      recentClaims: claimRows.filter((claim) => Date.parse(claim.created_at) >= Date.parse(in30DaysAgo)).length,
    },
    portfolio: [
      { key: "group", label: "Groups", value: portfolioCounts.get("group") ?? 0 },
      { key: "corporate", label: "Corporate", value: portfolioCounts.get("corporate") ?? 0 },
      { key: "dealership", label: "Dealerships", value: portfolioCounts.get("dealership") ?? 0 },
      { key: "individual", label: "Individual / Proprietor", value: portfolioCounts.get("individual") ?? 0 },
      { key: "posp", label: "POSP", value: portfolioCounts.get("posp") ?? 0 },
      { key: "misp", label: "MISP", value: portfolioCounts.get("misp") ?? 0 },
    ],
    attention: {
      onboarding: 0,
      submittedOnboarding: 0,
      changesRequested: 0,
      overdueTasks: taskRows.filter((task) => openTaskStatuses.includes(task.status) && Boolean(task.due_date) && task.due_date! < today).length,
      openTasks: taskRows.filter((task) => openTaskStatuses.includes(task.status)).length,
      documents: claimDocuments.data?.length ?? 0,
      highPriorityActivity: activity.data?.length ?? 0,
    },
    recentApplications: [],
    latestClaims: [...claimRows].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5).map((claim) => ({
      id: claim.id,
      claim_no: claim.claim_no,
      current_status: claim.current_status,
      updated_at: claim.updated_at,
      customers: claim.customers,
      vehicles: claim.vehicles,
    })),
    errors,
  };
}

function emptyDashboard(): OperationsDashboardData {
  return {
    totals: {
      customers: 0,
      activeCustomers: 0,
      newCustomers: 0,
      vehicles: 0,
      policies: 0,
      activePolicies: 0,
      expiringPolicies: 0,
      expiredPolicies: 0,
      claims: 0,
      openClaims: 0,
      recentClaims: 0,
    },
    portfolio: [
      { key: "group", label: "Groups", value: 0 },
      { key: "corporate", label: "Corporate", value: 0 },
      { key: "dealership", label: "Dealerships", value: 0 },
      { key: "individual", label: "Individual / Proprietor", value: 0 },
      { key: "posp", label: "POSP", value: 0 },
      { key: "misp", label: "MISP", value: 0 },
    ],
    attention: {
      onboarding: 0,
      submittedOnboarding: 0,
      changesRequested: 0,
      overdueTasks: 0,
      openTasks: 0,
      documents: 0,
      highPriorityActivity: 0,
    },
    recentApplications: [],
    latestClaims: [],
    errors: [],
  };
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
