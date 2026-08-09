import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PolicyWorkspace } from "./policy-workspace";

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  customers: { company_name: string | null; contact_name: string; created_by: string | null } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PoliciesPage() {
  const profile = await requireCapability("view_policies");
  if (!profile) redirect("/access-denied");

  const scope = await getEmployeeAccessScope(profile.id, profile.role);
  const admin = createSupabaseAdminClient();

  if (scope.mode !== "organization" && !scope.profileIds.length) {
    return <AppShell title="Policies"><PolicyWorkspace rows={[]} /></AppShell>;
  }

  let query = admin
    .from("policies")
    .select("id, policy_no, policy_type, start_date, end_date, customers!inner(company_name, contact_name, created_by), vehicles(vehicle_no), insurance_companies(name)")
    .order("created_at", { ascending: false });
  if (scope.mode !== "organization") query = query.in("customers.created_by", scope.profileIds);
  const { data, error } = await query.returns<PolicyRow[]>();

  return (
    <AppShell title="Policies">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-[11px] font-semibold text-red-700">The policy register is temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div> : <PolicyWorkspace rows={data ?? []} />}
    </AppShell>
  );
}
