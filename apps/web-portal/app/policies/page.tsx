import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { BackofficePolicyRegister } from "@/components/backoffice-policy-register";
import { ItSuperUserDeletePanel } from "@/components/it-super-user-delete-panel";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { logPortalRoutePerformance } from "@/lib/performance-observability";
import { PolicyWorkspace } from "./policy-workspace";

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  policy_product: string | null;
  business_line: string | null;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  policy_premium_details: { gross_premium: number | null } | null;
  policy_documents: { id: string; document_type: string; file_name: string; mime_type: string | null }[];
  customers: { company_name: string | null; contact_name: string; created_by: string | null } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
  non_motor_policy_details: { category: string | null; risk_title: string | null; risk_location: string | null; transit_from: string | null; transit_to: string | null; nature_of_business: string | null; liability_type: string | null; risk_details: Record<string, unknown> | null } | null;
  claims: { count: number }[];
};

type BackofficePolicyRow = Pick<PolicyRow, "id" | "policy_no" | "policy_type" | "start_date" | "end_date" | "insured_declared_value" | "premium_amount" | "customers" | "vehicles" | "insurance_companies">;
type IntermediarySourceRow = { intermediary_type: "partner" | "posp" | "misp"; intermediary_code: string | null; display_name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

function policySourceDatabaseType(value: string | null): IntermediarySourceRow["intermediary_type"] | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "sibl / partner" || normalized === "partner") return "partner";
  if (normalized === "posp") return "posp";
  if (normalized === "misp") return "misp";
  return null;
}
function sourceLookupKey(type: IntermediarySourceRow["intermediary_type"], code: string) { return `${type}:${code}`; }
function buildPolicySourceOptions(sourceRows: IntermediarySourceRow[]) {
  const sourceNameByKey = new Map<string, string>();
  const sourceOptions = sourceRows.map((source) => {
    const code = source.intermediary_code?.trim(); const name = source.display_name?.trim();
    if (!code || !name) return null;
    const value = sourceLookupKey(source.intermediary_type, code); sourceNameByKey.set(value, name); return { value, label: `${name} · ${code}` };
  }).filter((option): option is { value: string; label: string } => Boolean(option));
  return { sourceNameByKey, sourceOptions };
}

export default async function PoliciesPage({ searchParams }: { searchParams?: Promise<{ success?: string; policy?: string }> }) {
  const startedAt = performance.now();
  const profile = await requireCapability("view_policies");
  const afterAuth = performance.now();
  if (!profile) redirect("/access-denied");
  if (searchParams) await searchParams;
  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  const afterScope = performance.now();
  const admin = createSupabaseAdminClient();

  if (profile.role === "backoffice_executive") {
    if (accessibleCustomerIds !== null && !accessibleCustomerIds.length) {
      const finishedAt = performance.now();
      logPortalRoutePerformance("/policies", {
        auth_ms: afterAuth - startedAt,
        scope_ms: afterScope - afterAuth,
        data_ms: 0,
        total_ms: finishedAt - startedAt,
      });
      return <AppShell title="Policies"><BackofficePolicyRegister rows={[]} /></AppShell>;
    }
    let safeQuery = admin.from("policies").select("id,policy_no,policy_type,start_date,end_date,insured_declared_value,premium_amount,customers!inner(company_name,contact_name,created_by),vehicles(vehicle_no),insurance_companies(name)").order("created_at", { ascending: false });
    if (accessibleCustomerIds !== null) safeQuery = safeQuery.in("customer_id", accessibleCustomerIds);
    const { data, error } = await safeQuery.returns<BackofficePolicyRow[]>();
    const finishedAt = performance.now();
    logPortalRoutePerformance("/policies", {
      auth_ms: afterAuth - startedAt,
      scope_ms: afterScope - afterAuth,
      data_ms: finishedAt - afterScope,
      total_ms: finishedAt - startedAt,
    });
    return <AppShell title="Policies">{error ? <RegisterError /> : <BackofficePolicyRegister rows={data ?? []} />}</AppShell>;
  }

  const activeSourcesPromise = admin
    .from("intermediaries")
    .select("intermediary_type, intermediary_code, display_name")
    .in("intermediary_type", ["partner", "posp", "misp"])
    .eq("account_status", "active")
    .order("display_name", { ascending: true })
    .returns<IntermediarySourceRow[]>();

  if (accessibleCustomerIds !== null && !accessibleCustomerIds.length) {
    const sourceResult = await activeSourcesPromise;
    const finishedAt = performance.now();
    logPortalRoutePerformance("/policies", {
      auth_ms: afterAuth - startedAt,
      scope_ms: afterScope - afterAuth,
      data_ms: finishedAt - afterScope,
      total_ms: finishedAt - startedAt,
    });
    const { sourceOptions } = buildPolicySourceOptions(sourceResult.error ? [] : (sourceResult.data ?? []));
    return <AppShell title="Policies"><PolicyWorkspace rows={[]} sourceOptions={sourceOptions} /></AppShell>;
  }

  let query = admin.from("policies").select("id, policy_no, policy_type, policy_product, business_line, start_date, end_date, insured_declared_value, premium_amount, intermediary_type, intermediary_code, policy_premium_details(gross_premium), policy_documents(id, document_type, file_name, mime_type), customers!inner(company_name, contact_name, created_by), vehicles(vehicle_no), insurance_companies(name), non_motor_policy_details(category, risk_title, risk_location, transit_from, transit_to, nature_of_business, liability_type, risk_details), claims(count)").order("created_at", { ascending: false });
  if (accessibleCustomerIds !== null) query = query.in("customer_id", accessibleCustomerIds);
  const [sourceResult, policyResult] = await Promise.all([activeSourcesPromise, query.returns<PolicyRow[]>()]);
  const finishedAt = performance.now();
  logPortalRoutePerformance("/policies", {
    auth_ms: afterAuth - startedAt,
    scope_ms: afterScope - afterAuth,
    data_ms: finishedAt - afterScope,
    total_ms: finishedAt - startedAt,
  });
  const { sourceNameByKey, sourceOptions } = buildPolicySourceOptions(sourceResult.error ? [] : (sourceResult.data ?? []));
  const { data, error } = policyResult;
  const rows = data ?? [];
  const workspaceRows = rows.map((policy) => { const sourceType = policySourceDatabaseType(policy.intermediary_type); const sourceCode = policy.intermediary_code?.trim() ?? ""; return { ...policy, policy_documents: (policy.policy_documents ?? []).filter((document) => document.document_type === "policy_copy"), gross_premium: policy.policy_premium_details?.gross_premium ?? null, source_name: sourceType && sourceCode ? sourceNameByKey.get(sourceLookupKey(sourceType, sourceCode)) ?? null : null }; });

  return <AppShell title="Policies">
    
    {profile.role === "it_super_user" && !error ? <ItSuperUserDeletePanel entity="policy" title="Delete policy master record" records={rows.map((policy) => ({ id: policy.id, label: policy.policy_no, detail: [policy.vehicles?.vehicle_no, policy.customers?.contact_name, policy.insurance_companies?.name].filter(Boolean).join(" • ") }))} /> : null}
    {error ? <RegisterError /> : <PolicyWorkspace rows={workspaceRows} sourceOptions={sourceOptions} />}
  </AppShell>;
}
function RegisterError() { return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-[11px] font-semibold text-red-700">The policy register is temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div>; }
