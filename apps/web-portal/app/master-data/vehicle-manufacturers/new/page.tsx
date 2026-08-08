import { AppShell, PageHeader } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { ManufacturerForm } from "../manufacturer-form";
import { saveVehicleManufacturer } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewVehicleManufacturerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("manage_master_data", "edit");
  const params = await searchParams;
  return (
    <AppShell title="Add Vehicle Manufacturer" backHref="/master-data/vehicle-manufacturers">
      <PageHeader title="Add Vehicle Manufacturer" description="Create a canonical legal entity, then attach the operating brands, aliases and vehicle segments used by customer and intermediary workflows." />
      {params.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{params.error}</div> : null}
      <ManufacturerForm action={saveVehicleManufacturer.bind(null, null)} submitLabel="Create manufacturer" />
    </AppShell>
  );
}
