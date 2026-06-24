import { notFound } from "next/navigation";
import { updateVehicle } from "@/app/actions";
import { VehicleForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";

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

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [vehicleResult, customersResult, manufacturersResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("customer_id, vehicle_no, vehicle_type, make, model, chassis_no, engine_no, permit_no, year")
      .eq("id", id)
      .maybeSingle<VehicleValues>(),
    supabase.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    supabase.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }).returns<ManufacturerOption[]>()
  ]);

  if (vehicleResult.error || !vehicleResult.data) {
    notFound();
  }

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.company_name ?? customer.contact_name }));
  const manufacturerOptions = (manufacturersResult.data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));

  return <AppShell title="Edit vehicle"><PageHeader title="Edit vehicle" /><VehicleForm action={updateVehicle.bind(null, id)} customers={customerOptions} manufacturers={manufacturerOptions} values={vehicleResult.data} submitLabel="Save changes" /></AppShell>;
}
