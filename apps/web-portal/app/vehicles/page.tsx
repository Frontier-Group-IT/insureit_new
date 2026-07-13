import { AppShell } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { VehicleWorkspace } from "./vehicle-workspace";

type VehicleRow = {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  permit_no: string | null;
  customers: { company_name: string | null; contact_name: string } | null;
};

export default async function VehiclesPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, vehicle_no, vehicle_type, make, model, permit_no, customers(company_name, contact_name)")
    .order("created_at", { ascending: false })
    .returns<VehicleRow[]>();

  return (
    <AppShell title="Vehicles">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">{error.message}</div> : <VehicleWorkspace rows={data ?? []} />}
    </AppShell>
  );
}
