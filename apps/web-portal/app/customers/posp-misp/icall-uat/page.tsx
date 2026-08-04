import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { IcallUatPanel } from "@/app/intermediaries/applications/icall-uat-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  application_id: string;
  external_onboarding_id: string | null;
  pos_name: string | null;
  pos_first_name: string | null;
  pos_last_name: string | null;
  pan_number: string | null;
  applicant_phone: string | null;
  training_login_id: string | null;
  training_status: string | null;
  exam_status: string | null;
  workflow_stage: string;
  updated_at: string;
};

export default async function IcallUatPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireCapability("manage_system", "approve");
  const { q = "" } = await searchParams;
  const search = q.trim().slice(0, 80);
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("posp_misp_onboarding_profiles")
    .select("application_id,external_onboarding_id,pos_name,pos_first_name,pos_last_name,pan_number,applicant_phone,training_login_id,training_status,exam_status,workflow_stage,updated_at")
    .eq("partner_type", "posp")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (search) {
    query = query.or(`pan_number.ilike.%${escapeFilter(search)}%,pos_name.ilike.%${escapeFilter(search)}%,external_onboarding_id.ilike.%${escapeFilter(search)}%`);
  }

  const { data, error } = await query.returns<Row[]>();
  const rows = data ?? [];

  return <AppShell title="iCall UAT Integration">
    <div className="mx-auto max-w-[1280px] space-y-4 pb-8">
      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-r from-[#071D49] via-[#0F2A55] to-[#163B70] px-5 py-5 text-white">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/55">Integration testing</p>
            <h1 className="mt-1 text-xl font-semibold">iCall POSP Training — UAT</h1>
            <p className="mt-1 text-[10px] text-white/70">Register POSP applicants and sync training and examination status.</p>
          </div>
          <Link href="/customers/posp-misp" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-semibold text-white">Back to applications</Link>
        </div>
        <div className="border-t border-blue-100 bg-blue-50 px-5 py-3 text-[9.5px] text-blue-800">This page uses the iCall UAT endpoints. It does not call the production API.</div>
      </section>

      <form method="get" className="flex gap-2 rounded-2xl border border-[#DCE5EF] bg-white p-3 shadow-sm">
        <input name="q" defaultValue={search} placeholder="Search PAN, applicant name or onboarding ID" className="h-10 min-w-0 flex-1 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[10.5px] outline-none focus:border-blue-500" />
        <button className="h-10 rounded-xl bg-[#0F2A55] px-4 text-[10px] font-semibold text-white">Search</button>
        {search ? <Link href="/customers/posp-misp/icall-uat" className="grid h-10 place-items-center rounded-xl border border-[#CBD5E1] px-4 text-[10px] font-semibold text-[#475569]">Clear</Link> : null}
      </form>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] text-red-700">Could not load POSP applications.</div> : null}
      {!error && !rows.length ? <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-5 py-14 text-center text-[11px] text-[#64748B]">No matching POSP applications found.</div> : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const name = row.pos_name || [row.pos_first_name, row.pos_last_name].filter(Boolean).join(" ") || "Unnamed POSP";
          return <section key={row.application_id} className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#E5EAF0] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-[13px] font-semibold text-[#0F172A]">{name}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold text-slate-600">{row.workflow_stage.replaceAll("_", " ")}</span></div>
                <p className="mt-1 text-[9.5px] text-[#64748B]">{row.external_onboarding_id || row.application_id} · PAN {maskPan(row.pan_number)} · {row.applicant_phone || "No mobile"}</p>
              </div>
              <Link href={`/intermediaries/applications/${row.application_id}?stage=review`} className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-[9.5px] font-semibold text-[#334155]">Open application</Link>
            </div>
            <IcallUatPanel applicationId={row.application_id} partnerType="posp" loginId={row.training_login_id} trainingStatus={row.training_status} examStatus={row.exam_status} />
          </section>;
        })}
      </div>
    </div>
  </AppShell>;
}

function maskPan(value: string | null) {
  if (!value || value.length < 10) return "not available";
  return `${value.slice(0, 2)}*****${value.slice(-3)}`;
}

function escapeFilter(value: string) {
  return value.replace(/[,%()]/g, "");
}