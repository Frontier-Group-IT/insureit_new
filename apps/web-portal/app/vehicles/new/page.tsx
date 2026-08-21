import { addVehicleMaster } from "@/app/vehicles/vehicle-master-actions";
import { VehicleForm } from "@/components/forms";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type ManufacturerId = { id: string };
type BrandOption = { manufacturer_id: string; brand_name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ customer_id?: string }> }) {
  await requireCapability("view_vehicles", "edit");
  const admin = createSupabaseAdminClient();
  const params = await searchParams;

  const [customersResult, manufacturersResult, brandsResult] = await Promise.all([
    admin.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicle_manufacturers").select("id").eq("is_active", true).returns<ManufacturerId[]>(),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id, brand_name").eq("is_active", true).order("brand_name", { ascending: true }).returns<BrandOption[]>(),
  ]);

  if (customersResult.error || manufacturersResult.error || brandsResult.error) {
    return (
      <AppShell title="Add Vehicle">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
          <h2 className="text-[13px] font-semibold text-amber-900">Vehicle setup information is temporarily unavailable.</h2>
          <p className="mt-1 text-[10.5px] leading-5 text-amber-800">Customer and vehicle master data could not be loaded. Refresh the page or try again shortly; no information has been changed.</p>
        </div>
      </AppShell>
    );
  }

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const activeManufacturerIds = new Set((manufacturersResult.data ?? []).map((manufacturer) => manufacturer.id));
  const makeNames = Array.from(new Set((brandsResult.data ?? []).filter((brand) => activeManufacturerIds.has(brand.manufacturer_id)).map((brand) => brand.brand_name))).sort((a, b) => a.localeCompare(b));
  const manufacturerOptions = makeNames.map((name) => ({ value: name, label: name }));

  return (
    <AppShell title="Add Vehicle">
      <VehicleForm action={addVehicleMaster} customers={customerOptions} manufacturers={manufacturerOptions} values={{ customer_id: params.customer_id ?? null }} submitLabel="Create Vehicle" />
    </AppShell>
  );
}
