import Link from "next/link";
import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getAccessibleImportBatchIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Batch = {
  id: string;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  pending_rows: number;
  submitted_rows: number;
  failed_rows: number;
  status: string;
  created_at: string;
};

type SearchParams = { q?: string; status?: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImportBatchesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePospMispManager();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) return null;

  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const statusFilter = params.status ?? "open";
  const accessibleIds = await getAccessibleImportBatchIds(profile.id, profile.role);
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("posp_misp_import_batches")
    .select("id,file_name,total_rows,valid_rows,invalid_rows,pending_rows,submitted_rows,failed_rows,status,created_at")
    .order("created_at", { ascending: false });
  if (accessibleIds !== null) {
    if (!accessibleIds.length) query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    else query = query.in("id", accessibleIds);
  }
  if (q) query = query.ilike("file_name", `%${q}%`);

  const { data, error } = await query.returns<Batch[]>();
  const batches = (data ?? []).map((batch) => ({ ...batch, operationalStatus: operationalStatus(batch), remaining: remainingRows(batch) }));
  const filtered = batches.filter((batch) => statusFilter === "all" || (statusFilter === "open" ? batch.operationalStatus !== "completed" : batch.operationalStatus === statusFilter));
  const openCount = batches.filter((batch) => batch.operationalStatus !== "completed").length;
  const pendingCount = batches.reduce((sum, batch) => sum + batch.remaining, 0);
  const failedCount = batches.reduce((sum, batch) => sum + batch.failed_rows, 0);
  const completedCount = batches.filter((batch) => batch.operationalStatus === "completed").length;

  return <AppShell title="POSP / MISP Import Batches"><div className="mx-auto max-w-[1480px] space-y-4 pb-8">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
      <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6759FF]">Saved import history</p><h1 className="mt-1 text-xl font-semibold text-[#0F172A]">POSP / MISP Import Batches</h1><p className="mt-1 text-[10.5px] text-[#64748B]">Resume incomplete workbook onboarding without uploading the same file again.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/customers/posp-misp/import" className="rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-4 py-2.5 text-[10.5px] font-semibold text-white">New Excel Import</Link><Link href="/customers/posp-misp" className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10.5px] font-semibold text-[#334155]">Onboarding Applications</Link></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Open Batches" value={openCount}/><Metric label="Rows Remaining" value={pendingCount}/><Metric label="Failed Rows" value={failedCount}/><Metric label="Completed Batches" value={completedCount}/></section>

    <section className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
      <form className="flex flex-wrap items-center gap-2"><input name="q" defaultValue={q} placeholder="Search file name" className="h-10 min-w-[240px] flex-1 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[10.5px] outline-none focus:border-[#635BFF]"/><select name="status" defaultValue={statusFilter} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px]"><option value="open">Open / Incomplete</option><option value="needs_attention">Needs Attention</option><option value="ready">Ready to Submit</option><option value="processing">Processing</option><option value="partially_completed">Partially Completed</option><option value="completed">Completed</option><option value="all">All Batches</option></select><button className="h-10 rounded-xl bg-[#071D49] px-4 text-[10.5px] font-semibold text-white">Apply</button></form>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      {error ? <div className="p-5 text-[11px] text-red-700">The import batch register could not be loaded.</div> : filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left"><thead><tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[.06em] text-[#64748B]"><th className="px-4 py-3">Workbook</th><th className="px-4 py-3">Uploaded</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Ready</th><th className="px-4 py-3">Invalid</th><th className="px-4 py-3">Failed</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EDF2F7]">{filtered.map((batch) => { const completed = Math.max(0, batch.total_rows - batch.remaining); const progress = batch.total_rows ? Math.round((completed / batch.total_rows) * 100) : 0; return <tr key={batch.id} className="text-[10.5px] text-[#334155]"><td className="px-4 py-3"><p className="font-semibold text-[#0F172A]">{batch.file_name}</p><p className="mt-0.5 text-[9px] text-[#94A3B8]">{batch.id.slice(0,8).toUpperCase()}</p></td><td className="px-4 py-3">{formatDate(batch.created_at)}</td><td className="px-4 py-3"><div className="w-40"><div className="mb-1 flex justify-between text-[9px]"><span>{completed} of {batch.total_rows}</span><span>{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]"><div className="h-full rounded-full bg-gradient-to-r from-[#635BFF] to-[#17BFC5]" style={{width:`${progress}%`}}/></div></div></td><td className="px-4 py-3 text-emerald-700">{batch.valid_rows}</td><td className="px-4 py-3 text-amber-700">{batch.invalid_rows}</td><td className="px-4 py-3 text-red-700">{batch.failed_rows}</td><td className="px-4 py-3"><Status value={batch.operationalStatus}/></td><td className="px-4 py-3 text-right"><Link href={`/customers/posp-misp/import/${batch.id}`} className="inline-flex rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2 text-[10px] font-semibold text-[#4338CA]">{batch.operationalStatus === "completed" ? "View Batch" : "Resume Review"}</Link></td></tr>})}</tbody></table></div> : <div className="p-12 text-center"><p className="text-sm font-semibold text-[#0F172A]">No import batches found</p><p className="mt-1 text-[10.5px] text-[#64748B]">Upload a workbook or change the selected filter.</p></div>}
    </section>
  </div></AppShell>;
}

function remainingRows(batch: Batch) { return Math.max(0, batch.pending_rows + batch.invalid_rows + batch.failed_rows); }
function operationalStatus(batch: Batch) {
  const remaining = remainingRows(batch);
  if (!remaining && batch.total_rows > 0) return "completed";
  if (batch.failed_rows > 0 || batch.invalid_rows > 0) return "needs_attention";
  if (batch.status === "processing") return "processing";
  if (batch.submitted_rows > 0 && remaining > 0) return "partially_completed";
  if (batch.valid_rows > 0) return "ready";
  return "needs_attention";
}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#64748B]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#0F172A]">{value}</p></div>}
function Status({value}:{value:string}){const styles:Record<string,string>={completed:"bg-emerald-50 text-emerald-700 border-emerald-200",needs_attention:"bg-amber-50 text-amber-700 border-amber-200",ready:"bg-blue-50 text-blue-700 border-blue-200",processing:"bg-violet-50 text-violet-700 border-violet-200",partially_completed:"bg-cyan-50 text-cyan-700 border-cyan-200"};return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold capitalize ${styles[value]??styles.needs_attention}`}>{value.replaceAll("_"," ")}</span>}
function formatDate(value:string){return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date(value))}
