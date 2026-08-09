import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { VehicleWorkspace } from "./vehicle-workspace";

type VehicleRow = {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  permit_no: string | null;
  customers: { company_name: string | null; contact_name: string; created_by: string | null } | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehiclesPage() {
  const profile = await requireCapability("view_vehicles");
  if (!profile) redirect("/access-denied");

  const scope = await getEmployeeAccessScope(profile.id, profile.role);
  const admin = createSupabaseAdminClient();

  if (scope.mode !== "organization" && !scope.profileIds.length) {
    return <AppShell title="Vehicles"><VehicleWorkspace rows={[]} /></AppShell>;
  }

  let query = admin
    .from("vehicles")
    .select("id, vehicle_no, vehicle_type, make, model, permit_no, customers!inner(company_name, contact_name, created_by)")
    .order("created_at", { ascending: false });
  if (scope.mode !== "organization") query = query.in("customers.created_by", scope.profileIds);
  const { data, error } = await query.returns<VehicleRow[]>();

  return (
    <AppShell title="Vehicles">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-[11px] font-semibold text-red-700">The vehicle register is temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div> : <VehicleWorkspace rows={data ?? []} />}
    </AppShell>
  );
}
