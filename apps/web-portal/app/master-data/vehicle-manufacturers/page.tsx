import Image from "next/image";
import Link from "next/link";
import { Card, PageHeader, AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { VEHICLE_MANUFACTURER_SEGMENTS } from "@/lib/vehicle-manufacturer-master";

type ManufacturerRow = {
  id: string;
  manufacturer_code: string | null;
  name: string;
  display_name: string;
  slug: string;
  logo_path: string | null;
  logo_status: string;
  market_status: string;
  source_name: string | null;
  source_verified_at: string | null;
  is_active: boolean;
  sort_order: number;
};
type SegmentRow = { manufacturer_id: string; segment_code: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehicleManufacturerMasterPage({ searchParams }: { searchParams: Promise<{ q?: string; market?: string; segment?: string; activity?: string }> }) {
  await requireCapability("manage_master_data");
  const admin = createSupabaseAdminClient();
  const params = await searchParams;
  const [{ data: manufacturers, error }, { data: segments, error: segmentError }] = await Promise.all([
    admin.from("vehicle_manufacturers").select("id, manufacturer_code, name, display_name, slug, logo_path, logo_status, market_status, source_name, source_verified_at, is_active, sort_order").order("sort_order", { ascending: true }).order("display_name", { ascending: true }).returns<ManufacturerRow[]>(),
    admin.from("vehicle_manufacturer_segments").select("manufacturer_id, segment_code").returns<SegmentRow[]>(),
  ]);
  if (error) throw new Error(`Unable to load vehicle manufacturers: ${error.message}`);
  if (segmentError) throw new Error(`Unable to load manufacturer segments: ${segmentError.message}`);

  const segmentMap = new Map<string, string[]>();
  for (const segment of segments ?? []) segmentMap.set(segment.manufacturer_id, [...(segmentMap.get(segment.manufacturer_id) ?? []), segment.segment_code]);
  const q = params.q?.trim().toLowerCase() ?? "";
  const filtered = (manufacturers ?? []).filter((row) => {
    const rowSegments = segmentMap.get(row.id) ?? [];
    if (q && !`${row.display_name} ${row.name} ${row.manufacturer_code ?? ""}`.toLowerCase().includes(q)) return false;
    if (params.market && params.market !== "all" && row.market_status !== params.market) return false;
    if (params.activity === "active" && !row.is_active) return false;
    if (params.activity === "inactive" && row.is_active) return false;
    if (params.segment && params.segment !== "all" && !rowSegments.includes(params.segment)) return false;
    return true;
  });

  const all = manufacturers ?? [];
  const currentCount = all.filter((row) => row.market_status === "current").length;
  const legacyCount = all.filter((row) => row.market_status === "legacy").length;
  const verifiedLogoCount = all.filter((row) => row.logo_path && row.logo_status === "verified").length;

  return (
    <AppShell title="Vehicle Manufacturer Master">
      <PageHeader
        title="Vehicle Manufacturer Master"
        description="Canonical OEM register for vehicle, POSP/MISP and policy workflows. Legal entities, operational brands, aliases and source verification are maintained separately."
        action={<Link href="/master-data/vehicle-manufacturers/new" className="inline-flex h-10 items-center rounded-xl bg-[#6759ff] px-4 text-[11px] font-bold text-white shadow-[0_10px_26px_rgba(103,89,255,.24)] hover:bg-[#594be8]">Add manufacturer</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total manufacturers" value={all.length} detail="Canonical legal entities" />
        <Metric label="Current" value={currentCount} detail="Active/current market records" />
        <Metric label="Legacy" value={legacyCount} detail="Retained for historic policies" />
        <Metric label="Verified logo mappings" value={verifiedLogoCount} detail="Rows using local verified SVGs" />
      </div>

      <Card>
        <form className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_220px_150px_auto]" method="get">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search name or code..." className="h-10 rounded-xl border border-[#DCE2EC] bg-white px-3 text-[11px] outline-none focus:border-[#6759ff]" />
          <select name="market" defaultValue={params.market ?? "all"} className="h-10 rounded-xl border border-[#DCE2EC] bg-white px-3 text-[11px]"><option value="all">All market statuses</option><option value="current">Current</option><option value="legacy">Legacy</option><option value="ceased">Ceased</option><option value="pending_review">Pending review</option></select>
          <select name="segment" defaultValue={params.segment ?? "all"} className="h-10 rounded-xl border border-[#DCE2EC] bg-white px-3 text-[11px]"><option value="all">All segments</option>{VEHICLE_MANUFACTURER_SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="activity" defaultValue={params.activity ?? "all"} className="h-10 rounded-xl border border-[#DCE2EC] bg-white px-3 text-[11px]"><option value="all">Active + inactive</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select>
          <button className="h-10 rounded-xl border border-[#CDD5E3] bg-[#F8FAFD] px-4 text-[11px] font-bold text-[#34405A] hover:bg-white">Apply</button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[#E7EBF2] px-4 py-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#667085]">Manufacturer register</p><p className="mt-0.5 text-[11px] text-[#788198]">Showing {filtered.length} of {all.length} records</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="bg-[#F8FAFD] text-[9px] font-black uppercase tracking-[0.12em] text-[#667085]"><tr><th className="px-4 py-3">Manufacturer</th><th className="px-3 py-3">Code</th><th className="px-3 py-3">Segments</th><th className="px-3 py-3">Market</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Record</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-[#EEF1F6]">
              {filtered.map((row) => {
                const rowSegments = segmentMap.get(row.id) ?? [];
                return <tr key={row.id} className="bg-white/60 text-[11px] text-[#364158] hover:bg-[#FBFCFF]">
                  <td className="px-4 py-3"><div className="flex items-center gap-3">{row.logo_path ? <div className="grid h-10 w-14 place-items-center rounded-xl border border-[#E6EAF1] bg-white p-1.5"><Image src={row.logo_path} alt="" width={48} height={28} className="max-h-7 w-auto object-contain" /></div> : <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#6759ff]/12 to-[#17c7c9]/12 text-[11px] font-black text-[#5548cf]">{initials(row.display_name)}</div>}<div><Link href={`/master-data/vehicle-manufacturers/${row.id}`} className="font-bold text-[#1D2741] hover:text-[#6759ff]">{row.display_name}</Link><p className="mt-0.5 max-w-[340px] text-[10px] text-[#7B8498]">{row.name}</p></div></div></td>
                  <td className="px-3 py-3 font-mono text-[10px] text-[#59647B]">{row.manufacturer_code}</td>
                  <td className="px-3 py-3"><div className="flex max-w-[320px] flex-wrap gap-1">{rowSegments.slice(0, 3).map((segment) => <span key={segment} className="rounded-full border border-[#DDE4EF] bg-[#F8FAFD] px-2 py-1 text-[8.5px] font-bold text-[#566178]">{segmentLabel(segment)}</span>)}{rowSegments.length > 3 ? <span className="rounded-full bg-[#6759ff]/8 px-2 py-1 text-[8.5px] font-bold text-[#6759ff]">+{rowSegments.length - 3}</span> : null}</div></td>
                  <td className="px-3 py-3"><StatusPill value={row.market_status} /></td>
                  <td className="px-3 py-3"><p className="font-semibold text-[#3A465E]">{row.source_name ?? "—"}</p><p className="mt-0.5 text-[9px] text-[#8A93A7]">{row.source_verified_at ? new Date(row.source_verified_at).toLocaleDateString("en-IN") : "Not dated"}</p></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.is_active ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 text-right"><Link href={`/master-data/vehicle-manufacturers/${row.id}`} className="inline-flex h-8 items-center rounded-lg border border-[#D7DDE8] bg-white px-3 text-[10px] font-bold text-[#3D4961] hover:border-[#6759ff]/40 hover:text-[#6759ff]">Review</Link></td>
                </tr>;
              })}
              {!filtered.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-[11px] text-[#7C8598]">No manufacturers match the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) { return <Card><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#778096]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#171B35]">{value}</p><p className="mt-1 text-[10px] text-[#858DA0]">{detail}</p></Card>; }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function segmentLabel(value: string) { return VEHICLE_MANUFACTURER_SEGMENTS.find(([code]) => code === value)?.[1] ?? value.replaceAll("_", " "); }
function StatusPill({ value }: { value: string }) { const styles = value === "current" ? "bg-emerald-50 text-emerald-700" : value === "legacy" ? "bg-amber-50 text-amber-700" : value === "ceased" ? "bg-rose-50 text-rose-700" : "bg-violet-50 text-violet-700"; return <span className={`rounded-full px-2 py-1 text-[9px] font-bold capitalize ${styles}`}>{value.replaceAll("_", " ")}</span>; }
