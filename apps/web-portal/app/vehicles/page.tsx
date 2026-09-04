import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { BackofficeVehicleRegister } from "@/components/backoffice-vehicle-register";
import { ItSuperUserDeletePanel } from "@/components/it-super-user-delete-panel";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { logPortalRoutePerformance } from "@/lib/performance-observability";
import { VehicleWorkspace } from "./vehicle-workspace";

type VehicleRow = {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  permit_no: string | null;
  chassis_no: string | null;
  engine_no: string | null;
  registration_status: string | null;
  customers: { company_name: string | null; contact_name: string } | null;
  policies: { count: number }[];
  claims: { count: number }[];
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehiclesPage() {
  const startedAt = performance.now();
  const profile = await requireCapability("view_vehicles");
  const afterAuth = performance.now();
  if (!profile) redirect("/access-denied");

  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_vehicles");
  const afterScope = performance.now();
  const admin = createSupabaseAdminClient();

  if (accessibleCustomerIds !== null && !accessibleCustomerIds.length) {
    const finishedAt = performance.now();
    logPortalRoutePerformance("/vehicles", {
      auth_ms: afterAuth - startedAt,
      scope_ms: afterScope - afterAuth,
      data_ms: 0,
      total_ms: finishedAt - startedAt,
    });
    return <AppShell title="Vehicles">{profile.role === "backoffice_executive" ? <BackofficeVehicleRegister rows={[]} /> : <VehicleWorkspace rows={[]} />}</AppShell>;
  }

  let query = admin
    .from("vehicles")
    .select("id, vehicle_no, vehicle_type, make, model, permit_no, chassis_no, engine_no, registration_status, customers!inner(company_name, contact_name), policies(count), claims(count)")
    .order("created_at", { ascending: false });
  if (accessibleCustomerIds !== null) query = query.in("customer_id", accessibleCustomerIds);
  const { data, error } = await query.returns<VehicleRow[]>();
  const finishedAt = performance.now();
  logPortalRoutePerformance("/vehicles", {
    auth_ms: afterAuth - startedAt,
    scope_ms: afterScope - afterAuth,
    data_ms: finishedAt - afterScope,
    total_ms: finishedAt - startedAt,
  });
  const rows = data ?? [];

  return (
    <AppShell title="Vehicles">
      {profile.role === "it_super_user" && !error ? (
        <ItSuperUserDeletePanel
          entity="vehicle"
          title="Delete vehicle master record"
          records={rows.map((vehicle) => ({
            id: vehicle.id,
            label: vehicle.vehicle_no,
            detail: [vehicle.customers?.contact_name, vehicle.make, vehicle.model].filter(Boolean).join(" • ")
          }))}
        />
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-[11px] font-semibold text-red-700">The vehicle register is temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div> : profile.role === "backoffice_executive" ? <BackofficeVehicleRegister rows={rows} /> : <VehicleWorkspace rows={rows} />}
    </AppShell>
  );
}
