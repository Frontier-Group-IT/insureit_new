import { addVehicle } from "@/app/master-data-form-actions";
import { VehicleForm } from "@/components/forms";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type ManufacturerOption = { name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ customer_id?: string }> }) {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();
  const params = await searchParams;

  const [customersResult, manufacturersResult] = await Promise.all([
    admin.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }).returns<ManufacturerOption[]>()
  ]);

  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);

  const customerOptions = (customersResult.data ?? []).map((customer) => ({
    value: customer.id,
    label: customer.contact_name
  }));
  const manufacturerOptions = (manufacturersResult.data ?? []).map((manufacturer) => ({
    value: manufacturer.name,
    label: manufacturer.name
  }));

  return (
    <AppShell title="Add Vehicle">
      <VehicleForm
        action={addVehicle}
        customers={customerOptions}
        manufacturers={manufacturerOptions}
        values={{ customer_id: params.customer_id ?? null }}
        submitLabel="Create Vehicle"
      />
    </AppShell>
  );
}
