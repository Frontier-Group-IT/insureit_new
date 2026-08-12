import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessibleCustomerIds, getAccessibleIntermediaryApplicationIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import type { Capability } from "@/lib/roles";
import type { PermissionAccess } from "@/lib/permission-management";
import type { OperationalMetric, OperationalSummaryRepository } from "./operational-contract";

type CapabilityCheck = (capability: Capability, minimumAccess?: Exclude<PermissionAccess, "none">) => Promise<boolean>;
type ApplicationRow = { id: string; requested_type: string; partner_status: string | null; draft_data: Record<string, unknown> | null };

const CLOSED_CLAIM_STATUSES = ["Claim Complete", "Settled", "Closed"];
const OPEN_TASK_STATUSES = ["open", "in_progress"];

export function createOperationalSummaryRepository(input: {
  admin: SupabaseClient;
  profileId: string;
  role: string;
  can: CapabilityCheck;
}): OperationalSummaryRepository {
  return {
    async summarize(query) {
      const normalized = normalize(query);
      if (!normalized || normalized.length > 500) throw new Error("invalid_operational_query");
      const wantsOverview = /\b(dashboard|overview|summary|business|everything)\b/.test(normalized);
      const metrics: OperationalMetric[] = [];
      let assignedScope = false;

      if (wantsOverview || /\b(posp|misp|partner|intermediar)/.test(normalized)) {
        if (await input.can("view_intermediaries")) {
          const accessibleIds = await getAccessibleIntermediaryApplicationIds(input.profileId, input.role);
          assignedScope ||= accessibleIds !== null;
          let request = input.admin.from("intermediary_onboarding_applications").select("id,requested_type,partner_status,draft_data");
          if (accessibleIds !== null) request = accessibleIds.length ? request.in("id", accessibleIds) : request.in("id", ["00000000-0000-0000-0000-000000000000"]);
          const { data, error } = await request.returns<ApplicationRow[]>();
          if (error) throw new Error("operational_intermediary_query_failed");
          const rows = data ?? [];
          const account = /\bposp\b/.test(normalized) ? "posp" : /\bmisp\b/.test(normalized) ? "misp" : /\bpartner\b/.test(normalized) ? "partner" : null;
          const selected = account ? rows.filter((row) => accountContext(row) === account) : rows;
          const href = account === "posp" ? "/intermediaries/posp" : account === "misp" ? "/intermediaries/misp" : account === "partner" ? "/intermediaries/partner" : "/intermediaries";
          const labelPrefix = account ? account.toUpperCase() : "Intermediary";
          if (/\binactive\b/.test(normalized)) metrics.push(metric(`${account ?? "intermediary"}_inactive`, `Inactive ${labelPrefix} accounts`, selected.filter((row) => ["inactive_partner", "inactive"].includes(row.partner_status ?? "")).length, href));
          else if (/\bpending\b/.test(normalized)) metrics.push(metric(`${account ?? "intermediary"}_pending`, `Pending ${labelPrefix} accounts`, selected.filter((row) => row.partner_status !== "active_partner" && !["inactive_partner", "inactive"].includes(row.partner_status ?? "")).length, href));
          else metrics.push(metric(`${account ?? "intermediary"}_active`, `Active ${labelPrefix} accounts`, selected.filter((row) => row.partner_status === "active_partner").length, href));
        }
      }

      const wantsCustomers = wantsOverview || /\bcustomer/.test(normalized);
      const wantsVehicles = wantsOverview || /\b(vehicle|fleet)/.test(normalized);
      const wantsPolicies = wantsOverview || /\b(policy|policies|renewal|expired|expiring)/.test(normalized);
      const wantsClaims = wantsOverview || /\bclaim/.test(normalized);
      const needsCustomerScope = wantsCustomers || wantsVehicles || wantsPolicies || wantsClaims;
      let customerIds: string[] | null = null;
      if (needsCustomerScope) {
        customerIds = await getAccessibleCustomerIds(input.profileId, input.role, wantsClaims ? "view_claims" : wantsPolicies ? "view_policies" : wantsVehicles ? "view_vehicles" : "view_customers");
        assignedScope ||= customerIds !== null;
      }

      if (wantsCustomers && await input.can("view_customers")) {
        metrics.push(metric("customers_total", "Customers", await count(input.admin, "customers", customerIds === null ? undefined : { column: "id", values: customerIds }), "/customers"));
      }
      if (wantsVehicles && await input.can("view_vehicles")) {
        metrics.push(metric("vehicles_total", "Vehicles", await count(input.admin, "vehicles", customerIds === null ? undefined : { column: "customer_id", values: customerIds ?? [] }), "/vehicles"));
      }
      if (wantsPolicies && await input.can("view_policies")) {
        const today = new Date().toISOString().slice(0, 10);
        const status = /\bexpired\b/.test(normalized) ? "expired" : /\b(expiring|renewal)\b/.test(normalized) ? "expiring" : /\bactive\b/.test(normalized) ? "active" : "total";
        let request = input.admin.from("policies").select("id", { count: "exact", head: true });
        if (customerIds !== null) request = customerIds.length ? request.in("customer_id", customerIds) : request.in("customer_id", ["00000000-0000-0000-0000-000000000000"]);
        if (status === "expired") request = request.lt("end_date", today);
        if (status === "active") request = request.gte("end_date", today);
        if (status === "expiring") {
          const in45Days = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
          request = request.gte("end_date", today).lte("end_date", in45Days);
        }
        const result = await request;
        if (result.error) throw new Error("operational_policy_query_failed");
        metrics.push(metric(`policies_${status}`, `${title(status)} policies`, result.count ?? 0, "/policies"));
      }
      if (wantsClaims && await input.can("view_claims")) {
        let request = input.admin.from("claims").select("id", { count: "exact", head: true });
        if (customerIds !== null) request = customerIds.length ? request.in("customer_id", customerIds) : request.in("customer_id", ["00000000-0000-0000-0000-000000000000"]);
        const open = /\bopen\b/.test(normalized);
        if (open) request = request.not("current_status", "in", `(${CLOSED_CLAIM_STATUSES.map(quotePostgrest).join(",")})`);
        const result = await request;
        if (result.error) throw new Error("operational_claim_query_failed");
        metrics.push(metric(open ? "claims_open" : "claims_total", open ? "Open claims" : "Claims", result.count ?? 0, "/claims"));
      }

      if ((wantsOverview || /\b(task|overdue)/.test(normalized)) && await input.can("view_tasks")) {
        const scope = await getEmployeeAccessScope(input.profileId, input.role, "view_tasks");
        assignedScope ||= scope.mode !== "organization";
        let request = input.admin.from("claim_tasks").select("id", { count: "exact", head: true }).in("status", OPEN_TASK_STATUSES);
        if (scope.mode !== "organization") request = scope.profileIds.length ? request.in("assigned_to", scope.profileIds) : request.in("assigned_to", ["00000000-0000-0000-0000-000000000000"]);
        if (/\boverdue\b/.test(normalized)) request = request.lt("due_date", new Date().toISOString().slice(0, 10));
        const result = await request;
        if (result.error) throw new Error("operational_task_query_failed");
        metrics.push(metric(/\boverdue\b/.test(normalized) ? "tasks_overdue" : "tasks_open", /\boverdue\b/.test(normalized) ? "Overdue tasks" : "Open tasks", result.count ?? 0, "/tasks"));
      }

      return { metrics: deduplicate(metrics).slice(0, 8), asOf: new Date().toISOString(), scope: assignedScope ? "assigned" : "organization" };
    },
  };
}

async function count(admin: SupabaseClient, table: string, scope?: { column: string; values: string[] }) {
  let request = admin.from(table).select("id", { count: "exact", head: true });
  if (scope) request = scope.values.length ? request.in(scope.column, scope.values) : request.in(scope.column, ["00000000-0000-0000-0000-000000000000"]);
  const result = await request;
  if (result.error) throw new Error("operational_count_failed");
  return result.count ?? 0;
}

function accountContext(row: ApplicationRow): "partner" | "posp" | "misp" {
  const value = row.draft_data?.account_context;
  return value === "posp" || value === "misp" ? value : "partner";
}
function metric(key: string, label: string, value: number, href: string): OperationalMetric { return { key, label, value, href }; }
function normalize(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function title(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function quotePostgrest(value: string) { return `"${value.replaceAll('"', '\\"')}"`; }
function deduplicate(metrics: OperationalMetric[]) { return Array.from(new Map(metrics.map((item) => [item.key, item])).values()); }
