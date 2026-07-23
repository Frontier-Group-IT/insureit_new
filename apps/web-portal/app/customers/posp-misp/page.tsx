import Link from "next/link";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

type ProfileRow = {
  id: string;
  application_id: string;
  partner_type: "posp" | "misp";
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  city: string | null;
  training_status: string | null;
  exam_status: string | null;
  source: string;
  created_at: string;
  customer_onboarding_applications: { status: string; applicant_email: string | null } | null;
};

const partnerLabels = { posp: "POSP", misp: "MISP" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospMispPage() {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("posp_misp_onboarding_profiles")
    .select("id, application_id, partner_type, pos_name, misp_name, applicant_phone, city, training_status, exam_status, source, created_at, customer_onboarding_applications(status, applicant_email)")
    .order("created_at", { ascending: false })
    .returns<ProfileRow[]>();

  return (
    <AppShell title="POSP / MISP Onboarding">
      <div className="mx-auto max-w-[1440px] space-y-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-[#64748B]">Manual and Excel-sourced POSP/MISP applications before verification.</p>
          <div className="flex gap-2">
            <Link href="/customers/posp-misp/import" className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#334155]">Import Excel</Link>
            <Link href="/customers/posp-misp/new?partner_type=posp" className="rounded-md bg-[#4F46E5] px-3 py-2 text-[10.5px] font-semibold text-white">Add POSP</Link>
            <Link href="/customers/posp-misp/new?partner_type=misp" className="rounded-md bg-[#0F172A] px-3 py-2 text-[10.5px] font-semibold text-white">Add MISP</Link>
          </div>
        </div>

        {error ? <DataError message={error.message} /> : (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[11px]">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]">
                  <tr><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Mobile</th><th className="px-3 py-2.5">City</th><th className="px-3 py-2.5">Training</th><th className="px-3 py-2.5">Exam</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {(data ?? []).map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAFCFF]">
                      <td className="px-3 py-3 font-semibold text-[#0F172A]">{row.pos_name ?? row.misp_name ?? "-"}</td>
                      <td className="px-3 py-3">{partnerLabels[row.partner_type]}</td>
                      <td className="px-3 py-3 tabular-nums">{row.applicant_phone ?? "-"}</td>
                      <td className="px-3 py-3">{row.city ?? "-"}</td>
                      <td className="px-3 py-3">{row.training_status ?? "-"}</td>
                      <td className="px-3 py-3">{row.exam_status ?? "-"}</td>
                      <td className="px-3 py-3">{row.source === "excel_import" ? "Excel" : "Manual"}</td>
                      <td className="px-3 py-3"><StatusPill status={row.customer_onboarding_applications?.status ?? "submitted"} /></td>
                      <td className="px-3 py-3"><Link href={`/customers/applications/${row.application_id}`} className="font-semibold text-[#4F46E5] hover:underline">Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.length ? <div className="px-4 py-14 text-center text-[11px] text-[#64748B]">No POSP/MISP applications yet.</div> : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const complete = status === "approved";
  const attention = status === "changes_requested" || status === "rejected";
  const className = complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : attention ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${className}`}>{status.replaceAll("_", " ")}</span>;
}
