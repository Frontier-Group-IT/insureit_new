import { notFound } from "next/navigation";
import { saveVehicle } from "@/app/master-data-form-actions";
import { VehicleForm } from "@/components/forms";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type ManufacturerOption = { name: string };
type VehicleValues = {
  customer_id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  chassis_no: string | null;
  engine_no: string | null;
  permit_no: string | null;
  year: number | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  await requireMasterDataManager();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const [vehicleResult, customersResult, manufacturersResult] = await Promise.all([
    admin.from("vehicles").select("customer_id, vehicle_no, vehicle_type, make, model, chassis_no, engine_no, permit_no, year").eq("id", id).maybeSingle<VehicleValues>(),
    admin.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }).returns<ManufacturerOption[]>()
  ]);

  if (vehicleResult.error) throw new Error(`Unable to load vehicle details: ${vehicleResult.error.message}`);
  if (!vehicleResult.data) notFound();

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const manufacturerOptions = (manufacturersResult.data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));

  return (
    <AppShell title="Edit Vehicle">
      <VehicleForm action={saveVehicle.bind(null, id)} customers={customerOptions} manufacturers={manufacturerOptions} values={vehicleResult.data} submitLabel="Save changes" />
    </AppShell>
  );
}
