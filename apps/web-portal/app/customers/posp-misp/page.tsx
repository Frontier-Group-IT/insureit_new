import Link from "next/link";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requirePospMispManager } from "@/lib/master-data-server";

type QueueRow = {
  id: string;
  partner_type: "posp" | "misp";
  source: string;
  status: string;
  applicant_phone: string | null;
  applicant_name: string | null;
  city: string | null;
  external_onboarding_id: string | null;
  document_count: number;
  age_days: number;
  updated_at: string;
  total_count: number;
};

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospMispPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }> }) {
  await requirePospMispManager();
  const query = await searchParams;
  const q = query.q?.trim().slice(0, 100) || null;
  const partnerType = query.type === "posp" || query.type === "misp" ? query.type : "posp_misp";
  const status = ["submitted", "under_review", "changes_requested", "approved", "rejected"].includes(query.status ?? "") ? query.status! : null;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_kyc_application_queue", {
    p_query: q,
    p_partner_type: partnerType,
    p_status: status,
    p_source: null,
    p_page: page,
    p_page_size: PAGE_SIZE
  });

  const rows = (Array.isArray(data) ? data : []) as QueueRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell title="POSP / MISP Onboarding">
      <div className="mx-auto max-w-[1440px] space-y-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-[#64748B]">Manage manually entered and Excel-sourced applications through verification.</p>
            <p className="mt-1 text-[10px] font-medium text-[#475569]">{total} matching application{total === 1 ? "" : "s"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/customers/posp-misp/import" className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#334155]">Import Excel</Link>
            <Link href="/customers/posp-misp/new?partner_type=posp" className="rounded-md bg-[#4F46E5] px-3 py-2 text-[10.5px] font-semibold text-white">Add POSP</Link>
            <Link href="/customers/posp-misp/new?partner_type=misp" className="rounded-md bg-[#0F172A] px-3 py-2 text-[10.5px] font-semibold text-white">Add MISP</Link>
          </div>
        </div>

        <form method="get" className="grid gap-2 rounded-xl border border-[#DCE5EF] bg-white p-3 shadow-sm sm:grid-cols-[minmax(220px,1fr)_150px_180px_auto]">
          <input name="q" defaultValue={q ?? ""} aria-label="Search POSP or MISP applications" placeholder="Search name, mobile or external ID" className="h-9 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[11.5px] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" />
          <select name="type" defaultValue={partnerType === "posp_misp" ? "" : partnerType} aria-label="Partner type" className="h-9 rounded-md border border-[#CBD5E1] bg-white px-2.5 text-[11px]"><option value="">POSP & MISP</option><option value="posp">POSP</option><option value="misp">MISP</option></select>
          <select name="status" defaultValue={status ?? ""} aria-label="Application status" className="h-9 rounded-md border border-[#CBD5E1] bg-white px-2.5 text-[11px]"><option value="">All statuses</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="changes_requested">Changes requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
          <div className="flex gap-2"><button className="h-9 rounded-md bg-[#0F2A55] px-4 text-[10.5px] font-semibold text-white">Apply</button>{q || partnerType !== "posp_misp" || status ? <Link href="/customers/posp-misp" className="grid h-9 place-items-center rounded-md border border-[#CBD5E1] px-3 text-[10.5px] font-semibold text-[#475569]">Clear</Link> : null}</div>
        </form>

        {error ? <DataError message="The POSP/MISP queue could not be loaded." /> : (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[11px]">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]">
                  <tr><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Mobile</th><th className="px-3 py-2.5">City</th><th className="px-3 py-2.5">Documents</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Age</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAFCFF]">
                      <td className="px-3 py-3"><p className="font-semibold text-[#0F172A]">{row.applicant_name ?? "-"}</p><p className="mt-0.5 text-[9.5px] text-[#64748B]">{row.external_onboarding_id ?? "External ID not assigned"}</p></td>
                      <td className="px-3 py-3">{row.partner_type.toUpperCase()}</td>
                      <td className="px-3 py-3 tabular-nums">{row.applicant_phone ?? "-"}</td>
                      <td className="px-3 py-3">{row.city ?? "-"}</td>
                      <td className="px-3 py-3 font-semibold tabular-nums">{row.document_count}</td>
                      <td className="px-3 py-3">{row.source === "manager_portal" ? "Manager portal" : "Mobile app"}</td>
                      <td className="px-3 py-3"><span className={row.age_days >= 7 ? "font-semibold text-red-700" : row.age_days >= 3 ? "font-semibold text-amber-700" : "text-[#64748B]"}>{row.age_days === 0 ? "Today" : `${row.age_days}d`}</span></td>
                      <td className="px-3 py-3"><StatusPill status={row.status} /></td>
                      <td className="px-3 py-3"><Link href={`/customers/applications/${row.id}`} className="font-semibold text-[#4F46E5] hover:underline">{row.status === "approved" || row.status === "rejected" ? "View" : "Edit / Review"}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length ? <div className="px-4 py-14 text-center text-[11px] text-[#64748B]">No POSP/MISP applications match these filters.</div> : null}
            </div>
          </div>
        )}

        {!error && totalPages > 1 ? (
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
            <Link href={pageHref(q, partnerType, status, Math.max(1, page - 1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${page <= 1 ? "pointer-events-none text-[#94A3B8]" : "text-[#334155]"}`}>Previous</Link>
            <span className="text-[10.5px] font-semibold text-[#475569]">Page {Math.min(page, totalPages)} of {totalPages}</span>
            <Link href={pageHref(q, partnerType, status, Math.min(totalPages, page + 1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${page >= totalPages ? "pointer-events-none text-[#94A3B8]" : "text-[#334155]"}`}>Next</Link>
          </div>
        ) : null}
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

function pageHref(q: string | null, partnerType: string, status: string | null, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (partnerType !== "posp_misp") params.set("type", partnerType);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/customers/posp-misp${params.size ? `?${params.toString()}` : ""}`;
}
