import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ItSuperUserDeletePanel } from "@/components/it-super-user-delete-panel";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PolicyWorkspace } from "./policy-workspace";

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  policy_premium_details: { gross_premium: number | null } | null;
  customers: { company_name: string | null; contact_name: string; created_by: string | null } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
  claims: { count: number }[];
};

type IntermediarySourceRow = {
  intermediary_type: "partner" | "posp" | "misp";
  intermediary_code: string | null;
  display_name: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function policySourceDatabaseType(value: string | null): IntermediarySourceRow["intermediary_type"] | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "sibl / partner" || normalized === "partner") return "partner";
  if (normalized === "posp") return "posp";
  if (normalized === "misp") return "misp";
  return null;
}

function sourceLookupKey(type: IntermediarySourceRow["intermediary_type"], code: string) {
  return `${type}:${code}`;
}

export default async function PoliciesPage() {
  const profile = await requireCapability("view_policies");
  if (!profile) redirect("/access-denied");

  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  const admin = createSupabaseAdminClient();

  if (accessibleCustomerIds !== null && !accessibleCustomerIds.length) {
    return <AppShell title="Policies"><PolicyWorkspace rows={[]} /></AppShell>;
  }

  let query = admin
    .from("policies")
    .select("id, policy_no, policy_type, start_date, end_date, insured_declared_value, premium_amount, intermediary_type, intermediary_code, policy_premium_details(gross_premium), customers!inner(company_name, contact_name, created_by), vehicles(vehicle_no), insurance_companies(name), claims(count)")
    .order("created_at", { ascending: false });
  if (accessibleCustomerIds !== null) query = query.in("customer_id", accessibleCustomerIds);
  const { data, error } = await query.returns<PolicyRow[]>();
  const rows = data ?? [];

  const sourceCodes = Array.from(new Set(
    rows
      .filter((policy) => Boolean(policySourceDatabaseType(policy.intermediary_type)))
      .map((policy) => policy.intermediary_code?.trim())
      .filter((code): code is string => Boolean(code)),
  ));

  const sourceNameByKey = new Map<string, string>();
  if (sourceCodes.length) {
    const { data: intermediarySources } = await admin
      .from("intermediaries")
      .select("intermediary_type, intermediary_code, display_name")
      .in("intermediary_type", ["partner", "posp", "misp"])
      .in("intermediary_code", sourceCodes)
      .returns<IntermediarySourceRow[]>();

    for (const intermediary of intermediarySources ?? []) {
      const code = intermediary.intermediary_code?.trim();
      const name = intermediary.display_name?.trim();
      if (code && name) sourceNameByKey.set(sourceLookupKey(intermediary.intermediary_type, code), name);
    }
  }

  const workspaceRows = rows.map((policy) => {
    const sourceType = policySourceDatabaseType(policy.intermediary_type);
    const sourceCode = policy.intermediary_code?.trim() ?? "";
    return {
      ...policy,
      gross_premium: policy.policy_premium_details?.gross_premium ?? null,
      source_name: sourceType && sourceCode
        ? sourceNameByKey.get(sourceLookupKey(sourceType, sourceCode)) ?? null
        : null,
    };
  });

  return (
    <AppShell title="Policies">
      {profile.role === "it_super_user" && !error ? (
        <ItSuperUserDeletePanel
          entity="policy"
          title="Delete policy master record"
          records={rows.map((policy) => ({
            id: policy.id,
            label: policy.policy_no,
            detail: [policy.vehicles?.vehicle_no, policy.customers?.contact_name, policy.insurance_companies?.name].filter(Boolean).join(" • ")
          }))}
        />
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-[11px] font-semibold text-red-700">The policy register is temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div> : <PolicyWorkspace rows={workspaceRows} />}
    </AppShell>
  );
}
