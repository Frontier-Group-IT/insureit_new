import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { getEffectivePermission } from "@/lib/permission-management";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ExternalPolicyWorkspace } from "./external-policy-workspace";

type ExternalPolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  added_via: string;
  created_at: string;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
};
type ClaimRow = { external_policy_id: string | null };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExternalPoliciesPage() {
  const profile = await requireCapability("view_policies");
  if (!profile) redirect("/access-denied");

  const permission = await getEffectivePermission(profile.id, profile.role, "view_policies");
  const canEdit = permission.access === "edit" || permission.access === "approve";
  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  const admin = createSupabaseAdminClient();

  if (accessibleCustomerIds !== null && !accessibleCustomerIds.length) {
    return <AppShell title="External Policies"><ExternalPolicyWorkspace rows={[]} canEdit={canEdit} /></AppShell>;
  }

  let query = admin
    .from("external_policies")
    .select("id,policy_no,policy_type,start_date,end_date,insured_declared_value,premium_amount,added_via,created_at,customers!inner(company_name,contact_name),vehicles(vehicle_no),insurance_companies(name)")
    .order("created_at", { ascending: false });
  if (accessibleCustomerIds !== null) query = query.in("customer_id", accessibleCustomerIds);

  const { data, error } = await query.returns<ExternalPolicyRow[]>();
  const rows = data ?? [];
  const policyIds = rows.map((row) => row.id);
  const claimCounts = new Map<string, number>();
  if (policyIds.length) {
    const { data: claims } = await admin.from("claims").select("external_policy_id").in("external_policy_id", policyIds).returns<ClaimRow[]>();
    for (const claim of claims ?? []) {
      if (!claim.external_policy_id) continue;
      claimCounts.set(claim.external_policy_id, (claimCounts.get(claim.external_policy_id) ?? 0) + 1);
    }
  }

  return (
    <AppShell title="External Policies">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-[11px] font-semibold text-red-700">The external policy register is temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div>
      ) : (
        <ExternalPolicyWorkspace rows={rows.map((row) => ({ ...row, claim_count: claimCounts.get(row.id) ?? 0 }))} canEdit={canEdit} />
      )}
    </AppShell>
  );
}
