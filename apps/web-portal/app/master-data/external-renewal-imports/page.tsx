import { AppShell, PageHeader } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ExternalRenewalImportForm } from "./import-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PartnerOption = { id: string; partner_code: string | null; display_name: string | null };
type BatchRow = {
  id: string;
  partner_id: string;
  source_name: string;
  source_file_name: string | null;
  source_period: string | null;
  status: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows: number;
  published_at: string | null;
  created_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export default async function ExternalRenewalImportsPage() {
  await requireCapability("manage_master_data", "edit");
  const admin = createSupabaseAdminClient();
  const [{ data: partners }, { data: batches }] = await Promise.all([
    admin.from("partners").select("id,partner_code,display_name").eq("partner_status", "active_partner").order("display_name").returns<PartnerOption[]>(),
    admin.from("external_renewal_import_batches").select("id,partner_id,source_name,source_file_name,source_period,status,total_rows,accepted_rows,rejected_rows,duplicate_rows,published_at,created_at").order("created_at", { ascending: false }).limit(12).returns<BatchRow[]>(),
  ]);
  const partnerMap = new Map((partners ?? []).map((partner) => [partner.id, partner.display_name || partner.partner_code || "Partner"]));

  return (
    <AppShell title="External Renewal Imports">
      <div className="mx-auto max-w-[1180px] space-y-4">
        <PageHeader title="External Renewal Imports" description="Upload partner-supplied external policy opportunity workbooks without adding records to verified INSUREIT customer, vehicle or policy registers." />

        <ExternalRenewalImportForm partners={partners ?? []} />

        <section className="overflow-hidden rounded-[22px] border border-[#D8E2F1] bg-white shadow-[0_16px_40px_rgba(31,45,78,0.05)]">
          <div className="flex items-center justify-between border-b border-[#E5EAF2] px-5 py-4">
            <div>
              <h2 className="text-[14px] font-bold text-[#17213e]">Recent Imports</h2>
              <p className="mt-0.5 text-[10.5px] text-[#7A8499]">Published batches remain isolated external-renewal opportunity data.</p>
            </div>
            <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[10px] font-semibold text-[#475467]">Last 12 batches</span>
          </div>
          {batches?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-[#F8FAFC] text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#7A8499]">
                  <tr><th className="px-5 py-3">Partner / Source</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Rows</th><th className="px-4 py-3">Published</th><th className="px-5 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF1F5] text-[11px] text-[#344054]">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-[#FAFBFD]">
                      <td className="px-5 py-3.5"><p className="font-semibold text-[#17213e]">{partnerMap.get(batch.partner_id) ?? "Partner"}</p><p className="mt-0.5 text-[10px] text-[#7A8499]">{batch.source_name}{batch.source_period ? ` · ${batch.source_period}` : ""}</p></td>
                      <td className="max-w-[260px] truncate px-4 py-3.5 text-[10.5px] text-[#667085]">{batch.source_file_name ?? "—"}</td>
                      <td className="px-4 py-3.5"><span className="font-semibold">{batch.accepted_rows}</span> published <span className="text-[#98A2B3]">/ {batch.total_rows}</span><p className="mt-0.5 text-[9.5px] text-[#98A2B3]">{batch.rejected_rows} rejected · {batch.duplicate_rows} duplicates</p></td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[10.5px] text-[#667085]">{formatDateTime(batch.published_at ?? batch.created_at)}</td>
                      <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[9.5px] font-semibold ${batch.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-[#F2F4F7] text-[#475467]"}`}>{batch.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="px-5 py-8 text-center text-[11px] text-[#7A8499]">No external renewal imports yet.</div>}
        </section>

        <section className="rounded-xl border border-[#D9E4F7] bg-[#F6F9FF] px-4 py-3 text-[10.5px] leading-5 text-[#53627A]">
          <strong className="text-[#244A9B]">Isolation rule:</strong> this importer writes only to <code>external_renewal_import_batches</code> and <code>external_renewal_opportunities</code>. It does not create or update verified customers, vehicles or policies.
        </section>
      </div>
    </AppShell>
  );
}
