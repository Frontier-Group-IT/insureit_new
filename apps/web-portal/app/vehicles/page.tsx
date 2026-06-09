import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

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
      <PageHeader title="Vehicles" action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/vehicles/new">Add vehicle</Link>} />
      <SearchFilterBar searchPlaceholder="Search vehicles by registration number, customer, permit, or type" filterLabel="Vehicle status" />
      {error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No vehicles added yet" emptyDescription="No vehicles added yet. Add a commercial vehicle and link it with a customer profile." columns={[
        { header: "Vehicle", cell: (vehicle) => <><p className="font-mono font-semibold text-navy-900">{vehicle.vehicle_no}</p><p className="text-xs text-slate-500">{vehicle.vehicle_type}</p></> },
        { header: "Customer", cell: (vehicle) => vehicle.customers?.company_name ?? vehicle.customers?.contact_name ?? "—" },
        { header: "Make / model", cell: (vehicle) => [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—" },
        { header: "Permit", cell: (vehicle) => vehicle.permit_no ?? "—" },
        { header: "", cell: (vehicle) => <Link className="font-semibold text-navy-700" href={`/vehicles/${vehicle.id}/edit`}>Edit</Link> }
      ]} />}
    </AppShell>
  );
}
