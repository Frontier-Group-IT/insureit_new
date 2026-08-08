import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { VEHICLE_MANUFACTURER_SEGMENTS } from "@/lib/vehicle-manufacturer-master";
import { setVehicleManufacturerActive } from "../actions";

type Manufacturer = {
  id: string; manufacturer_code: string | null; name: string; display_name: string; slug: string;
  parent_group_name: string | null; country_of_origin: string | null; india_presence_type: string | null;
  website_url: string | null; market_status: string; logo_path: string | null; logo_source_url: string | null;
  logo_status: string; source_name: string | null; source_url: string | null; source_verified_at: string | null;
  is_active: boolean; sort_order: number; created_at: string; updated_at: string;
};
type Segment = { segment_code: string };
type Brand = { brand_name: string; is_primary: boolean; logo_path: string | null };
type Alias = { alias: string; source: string | null };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehicleManufacturerReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireCapability("manage_master_data");
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  const [manufacturerResult, segmentsResult, brandsResult, aliasesResult] = await Promise.all([
    admin.from("vehicle_manufacturers").select("id, manufacturer_code, name, display_name, slug, parent_group_name, country_of_origin, india_presence_type, website_url, market_status, logo_path, logo_source_url, logo_status, source_name, source_url, source_verified_at, is_active, sort_order, created_at, updated_at").eq("id", id).maybeSingle<Manufacturer>(),
    admin.from("vehicle_manufacturer_segments").select("segment_code").eq("manufacturer_id", id).order("segment_code").returns<Segment[]>(),
    admin.from("vehicle_manufacturer_brands").select("brand_name, is_primary, logo_path").eq("manufacturer_id", id).eq("is_active", true).order("is_primary", { ascending: false }).order("brand_name").returns<Brand[]>(),
    admin.from("vehicle_manufacturer_aliases").select("alias, source").eq("manufacturer_id", id).eq("is_active", true).order("alias").returns<Alias[]>(),
  ]);
  if (manufacturerResult.error) throw new Error(manufacturerResult.error.message);
  const manufacturer = manufacturerResult.data;
  if (!manufacturer) notFound();
  if (segmentsResult.error || brandsResult.error || aliasesResult.error) throw new Error(segmentsResult.error?.message ?? brandsResult.error?.message ?? aliasesResult.error?.message ?? "Unable to load manufacturer details.");

  return (
    <AppShell title={manufacturer.display_name} backHref="/master-data/vehicle-manufacturers">
      <PageHeader
        title={manufacturer.display_name}
        description={manufacturer.name}
        action={<><Link href={`/master-data/vehicle-manufacturers/${id}/edit`} className="inline-flex h-10 items-center rounded-xl border border-[#D5DCE8] bg-white px-4 text-[11px] font-bold text-[#34405A] hover:border-[#6759ff]/40 hover:text-[#6759ff]">Edit master</Link><Link href="/master-data/vehicle-manufacturers" className="inline-flex h-10 items-center rounded-xl bg-[#17213B] px-4 text-[11px] font-bold text-white">Back to register</Link></>}
      />

      {query.success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-semibold text-emerald-700">Manufacturer master {query.success} successfully.</div> : null}
      {query.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{query.error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6759ff]">Registered identity</p><h2 className="mt-1 text-lg font-semibold text-[#171B35]">Legal manufacturer record</h2></div>
              {manufacturer.logo_path ? <div className="grid h-20 w-36 place-items-center rounded-2xl border border-[#E2E7F0] bg-white p-3"><Image src={manufacturer.logo_path} alt={`${manufacturer.display_name} logo`} width={110} height={52} className="max-h-12 w-auto object-contain" /></div> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#6759ff]/8 text-lg font-black text-[#6759ff]">{initials(manufacturer.display_name)}</div>}
            </div>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Fact label="Legal name" value={manufacturer.name} />
              <Fact label="Display name" value={manufacturer.display_name} />
              <Fact label="Manufacturer code" value={manufacturer.manufacturer_code} mono />
              <Fact label="Slug" value={manufacturer.slug} mono />
              <Fact label="Parent group" value={manufacturer.parent_group_name} />
              <Fact label="Country of origin" value={manufacturer.country_of_origin} />
              <Fact label="India presence" value={manufacturer.india_presence_type} />
              <Fact label="Market status" value={manufacturer.market_status.replaceAll("_", " ")} />
              <Fact label="Sort order" value={String(manufacturer.sort_order)} />
            </div>
          </Card>

          <Card>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#17A7A9]">Operational matching</p>
            <h2 className="mt-1 text-lg font-semibold text-[#171B35]">Segments, brands & aliases</h2>
            <div className="mt-4 space-y-5">
              <TokenGroup label="Segments" values={(segmentsResult.data ?? []).map((item) => segmentLabel(item.segment_code))} />
              <TokenGroup label="Brands / makes" values={(brandsResult.data ?? []).map((item) => `${item.brand_name}${item.is_primary ? " · primary" : ""}`)} />
              <TokenGroup label="Aliases / RC variations" values={(aliasesResult.data ?? []).map((item) => item.alias)} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F59E0B]">Verification</p>
            <h2 className="mt-1 text-lg font-semibold text-[#171B35]">Source provenance</h2>
            <div className="mt-4 space-y-4">
              <Fact label="Source" value={manufacturer.source_name} />
              <Fact label="Source URL" value={manufacturer.source_url} breakAll />
              <Fact label="Verified on" value={manufacturer.source_verified_at ? new Date(manufacturer.source_verified_at).toLocaleDateString("en-IN") : null} />
              <Fact label="Logo status" value={manufacturer.logo_status.replaceAll("_", " ")} />
              <Fact label="Logo source" value={manufacturer.logo_source_url} breakAll />
              <Fact label="Website" value={manufacturer.website_url} breakAll />
            </div>
          </Card>

          <Card>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#667085]">Operational state</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#E3E8F0] bg-[#F9FBFD] p-3">
              <div><p className="text-[12px] font-bold text-[#26324A]">{manufacturer.is_active ? "Active" : "Inactive"}</p><p className="mt-0.5 text-[10px] leading-4 text-[#7B8498]">Inactive manufacturers stay in history but are removed from new operational selections.</p></div>
              <form action={setVehicleManufacturerActive.bind(null, id, !manufacturer.is_active)}><button className={`h-9 rounded-xl px-3 text-[10px] font-bold ${manufacturer.is_active ? "border border-rose-200 bg-rose-50 text-rose-700" : "bg-emerald-600 text-white"}`}>{manufacturer.is_active ? "Deactivate" : "Activate"}</button></form>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><Fact label="Created" value={new Date(manufacturer.created_at).toLocaleString("en-IN")} /><Fact label="Last updated" value={new Date(manufacturer.updated_at).toLocaleString("en-IN")} /></div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Fact({ label, value, mono = false, breakAll = false }: { label: string; value?: string | null; mono?: boolean; breakAll?: boolean }) { return <div><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8991A4]">{label}</p><p className={`mt-1 text-[11px] font-semibold text-[#34405A] ${mono ? "font-mono" : ""} ${breakAll ? "break-all" : ""}`}>{value || "—"}</p></div>; }
function TokenGroup({ label, values }: { label: string; values: string[] }) { return <div><p className="mb-2 text-[9px] font-black uppercase tracking-[0.12em] text-[#8991A4]">{label}</p><div className="flex flex-wrap gap-1.5">{values.length ? values.map((value) => <span key={value} className="rounded-full border border-[#DDE4EF] bg-[#F8FAFD] px-2.5 py-1.5 text-[9.5px] font-semibold text-[#4E5A73]">{value}</span>) : <span className="text-[10px] text-[#9AA2B2]">None recorded</span>}</div></div>; }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function segmentLabel(value: string) { return VEHICLE_MANUFACTURER_SEGMENTS.find(([code]) => code === value)?.[1] ?? value.replaceAll("_", " "); }
