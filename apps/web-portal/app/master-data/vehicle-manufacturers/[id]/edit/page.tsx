import { notFound } from "next/navigation";
import { AppShell, PageHeader } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { saveVehicleManufacturer } from "../../actions";
import { ManufacturerForm } from "../../manufacturer-form";

type Manufacturer = {
  manufacturer_code: string | null; name: string; display_name: string; slug: string;
  parent_group_name: string | null; country_of_origin: string | null; india_presence_type: string | null;
  website_url: string | null; market_status: string; logo_path: string | null; logo_source_url: string | null;
  logo_status: string; source_name: string | null; source_url: string | null; source_verified_at: string | null;
  is_active: boolean; sort_order: number;
};
type Segment = { segment_code: string };
type Brand = { brand_name: string };
type Alias = { alias: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditVehicleManufacturerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireCapability("manage_master_data", "edit");
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  const [manufacturerResult, segmentsResult, brandsResult, aliasesResult] = await Promise.all([
    admin.from("vehicle_manufacturers").select("manufacturer_code, name, display_name, slug, parent_group_name, country_of_origin, india_presence_type, website_url, market_status, logo_path, logo_source_url, logo_status, source_name, source_url, source_verified_at, is_active, sort_order").eq("id", id).maybeSingle<Manufacturer>(),
    admin.from("vehicle_manufacturer_segments").select("segment_code").eq("manufacturer_id", id).returns<Segment[]>(),
    admin.from("vehicle_manufacturer_brands").select("brand_name").eq("manufacturer_id", id).eq("is_active", true).order("is_primary", { ascending: false }).order("brand_name").returns<Brand[]>(),
    admin.from("vehicle_manufacturer_aliases").select("alias").eq("manufacturer_id", id).eq("is_active", true).order("alias").returns<Alias[]>(),
  ]);
  if (manufacturerResult.error) throw new Error(manufacturerResult.error.message);
  if (!manufacturerResult.data) notFound();
  if (segmentsResult.error || brandsResult.error || aliasesResult.error) throw new Error(segmentsResult.error?.message ?? brandsResult.error?.message ?? aliasesResult.error?.message ?? "Unable to load manufacturer master.");

  return (
    <AppShell title={`Edit ${manufacturerResult.data.display_name}`} backHref={`/master-data/vehicle-manufacturers/${id}`}>
      <PageHeader title={`Edit ${manufacturerResult.data.display_name}`} description="Update the canonical identity and operational matching values. Changes take effect in new vehicle and intermediary selections immediately after save." />
      {query.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{query.error}</div> : null}
      <ManufacturerForm
        action={saveVehicleManufacturer.bind(null, id)}
        values={manufacturerResult.data}
        selectedSegments={(segmentsResult.data ?? []).map((item) => item.segment_code)}
        brands={(brandsResult.data ?? []).map((item) => item.brand_name).join("\n")}
        aliases={(aliasesResult.data ?? []).map((item) => item.alias).join("\n")}
        submitLabel="Save manufacturer"
        cancelHref={`/master-data/vehicle-manufacturers/${id}`}
      />
    </AppShell>
  );
}
