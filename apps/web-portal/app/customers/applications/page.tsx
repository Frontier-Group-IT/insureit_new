import Link from "next/link";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

type SearchParams = {
  q?: string;
  partner?: string;
  status?: string;
  source?: string;
  page?: string;
};

type ApplicationRow = {
  id: string;
  partner_type: string | null;
  source: string;
  status: string;
  current_step: number;
  applicant_phone: string | null;
  applicant_email: string | null;
  customer_id: string | null;
  applicant_name: string | null;
  city: string | null;
  state: string | null;
  external_onboarding_id: string | null;
  document_count: number;
  age_days: number;
  updated_at: string;
  total_count: number;
};

const PAGE_SIZE = 25;
const partnerOptions = [
  ["individual_proprietor", "Individual / Proprietor"],
  ["dealership", "Dealership"],
  ["corporate", "Corporate"],
  ["group", "Group"],
  ["posp", "POSP"],
  ["misp", "MISP"]
] as const;
const statusOptions = [
  ["not_started", "Not started"],
  ["in_progress", "In progress"],
  ["submitted", "Submitted"],
  ["under_review", "Under review"],
  ["changes_requested", "Changes requested"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["cancelled", "Cancelled"]
] as const;
const partnerLabels = Object.fromEntries(partnerOptions);
const statusLabels = Object.fromEntries(statusOptions);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireMasterDataManager();
  const query = await searchParams;
  const q = clean(query.q);
  const partner = allowed(query.partner, new Set(partnerOptions.map(([value]) => value)));
  const status = allowed(query.status, new Set(statusOptions.map(([value]) => value)));
  const source = allowed(query.source, new Set(["customer_app", "manager_portal"]));
  const page = positiveInteger(query.page);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_kyc_application_queue", {
    p_query: q,
    p_partner_type: partner,
    p_status: status,
    p_source: source,
    p_page: page,
    p_page_size: PAGE_SIZE
  });

  const rows = (Array.isArray(data) ? data : []) as ApplicationRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstResult = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(page * PAGE_SIZE, total);
  const activeFilters = Boolean(q || partner || status || source);
  const hrefParams = { q, partner, status, source };

  return (
    <AppShell title="KYC Applications">
      <div className="mx-auto max-w-[1440px] space-y-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-[#64748B]">Review submitted onboarding applications, document readiness and queue age.</p>
            <p className="mt-1 text-[10px] font-medium text-[#475569]">{total ? `Showing ${firstResult}-${lastResult} of ${total} applications` : "No matching applications"}</p>
          </div>
          <Link href="/customers" className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#334155]">Customers</Link>
        </div>

        <form method="get" className="grid gap-2 rounded-xl border border-[#DCE5EF] bg-white p-3 shadow-sm md:grid-cols-[minmax(220px,1fr)_180px_180px_170px_auto]">
          <label className="relative">
            <span className="sr-only">Search applications</span>
            <input name="q" defaultValue={q ?? ""} placeholder="Search name, mobile, email or external ID" className="h-9 w-full rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[11.5px] text-[#0F172A] outline-none placeholder:text-[#8A97A8] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" />
          </label>
          <QueueSelect name="partner" defaultValue={partner ?? ""} label="Partner type" options={partnerOptions} />
          <QueueSelect name="status" defaultValue={status ?? ""} label="Status" options={statusOptions} />
          <QueueSelect name="source" defaultValue={source ?? ""} label="Source" options={[["customer_app", "Mobile app"], ["manager_portal", "Manager portal"]]} />
          <div className="flex gap-2">
            <button className="h-9 flex-1 rounded-md bg-[#0F2A55] px-4 text-[10.5px] font-semibold text-white">Apply</button>
            {activeFilters ? <Link href="/customers/applications" className="grid h-9 place-items-center rounded-md border border-[#CBD5E1] px-3 text-[10.5px] font-semibold text-[#475569]">Clear</Link> : null}
          </div>
        </form>

        {error ? <DataError message="The KYC queue could not be loaded. Refresh the page or contact an administrator if the issue continues." /> : (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] text-left text-[11px]">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]">
                  <tr><th className="px-3 py-2.5">Applicant</th><th className="px-3 py-2.5">Partner</th><th className="px-3 py-2.5">Location</th><th className="px-3 py-2.5">Documents</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Queue Age</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Updated</th><th className="px-3 py-2.5">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {rows.map((application) => (
                    <tr key={application.id} className="hover:bg-[#FAFCFF]">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[#0F172A]">{application.applicant_name ?? application.applicant_phone ?? "-"}</p>
                        <p className="mt-0.5 text-[9.5px] text-[#64748B]">{application.external_onboarding_id ?? application.applicant_phone ?? application.applicant_email ?? "-"}</p>
                      </td>
                      <td className="px-3 py-3">{application.partner_type ? partnerLabels[application.partner_type] ?? application.partner_type : "Not selected"}</td>
                      <td className="px-3 py-3">{[application.city, application.state].filter(Boolean).join(", ") || "-"}</td>
                      <td className="px-3 py-3"><span className="tabular-nums font-semibold text-[#334155]">{application.document_count}</span></td>
                      <td className="px-3 py-3">{application.source === "customer_app" ? "Mobile app" : "Manager portal"}</td>
                      <td className="px-3 py-3"><AgePill days={application.age_days} /></td>
                      <td className="px-3 py-3"><StatusPill status={application.status} /></td>
                      <td className="px-3 py-3 text-[#64748B]">{formatDateTime(application.updated_at)}</td>
                      <td className="px-3 py-3">{application.customer_id ? <Link href={`/customers/${application.customer_id}/edit`} className="font-semibold text-[#4F46E5] hover:underline">Open customer</Link> : <Link href={`/customers/applications/${application.id}`} className="font-semibold text-[#4F46E5] hover:underline">Review</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length ? <div className="px-4 py-14 text-center"><p className="text-[12px] font-semibold text-[#334155]">{activeFilters ? "No applications match these filters." : "No KYC applications yet."}</p><p className="mt-1 text-[10.5px] text-[#64748B]">{activeFilters ? "Clear or adjust the filters to widen the queue." : "Submitted mobile and manager onboarding records will appear here."}</p></div> : null}
            </div>
          </div>
        )}

        {!error && totalPages > 1 ? <Pagination currentPage={page} totalPages={totalPages} params={hrefParams} /> : null}
      </div>
    </AppShell>
  );
}

function QueueSelect({ name, defaultValue, label, options }: { name: string; defaultValue: string; label: string; options: readonly (readonly [string, string])[] }) {
  const allLabel = label === "Status" ? "All statuses" : label === "Partner type" ? "All partner types" : "All sources";
  return <select name={name} defaultValue={defaultValue} aria-label={label} className="h-9 rounded-md border border-[#CBD5E1] bg-white px-2.5 text-[11px] text-[#334155] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]"><option value="">{allLabel}</option>{options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select>;
}

function Pagination({ currentPage, totalPages, params }: { currentPage: number; totalPages: number; params: Record<string, string | null> }) {
  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter((page) => page >= 1 && page <= totalPages))];
  return (
    <nav aria-label="KYC application pages" className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
      <Link aria-disabled={currentPage <= 1} href={queueHref(params, Math.max(1, currentPage - 1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${currentPage <= 1 ? "pointer-events-none border-[#E2E8F0] text-[#94A3B8]" : "border-[#CBD5E1] text-[#334155]"}`}>Previous</Link>
      <div className="flex items-center gap-1">
        {pages.map((page, index) => <span key={page} className="contents">{index > 0 && page - pages[index - 1] > 1 ? <span className="px-1 text-[10px] text-[#94A3B8]">...</span> : null}<Link href={queueHref(params, page)} aria-current={page === currentPage ? "page" : undefined} className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[10.5px] font-semibold ${page === currentPage ? "bg-[#0F2A55] text-white" : "text-[#475569] hover:bg-[#F1F5F9]"}`}>{page}</Link></span>)}
      </div>
      <Link aria-disabled={currentPage >= totalPages} href={queueHref(params, Math.min(totalPages, currentPage + 1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${currentPage >= totalPages ? "pointer-events-none border-[#E2E8F0] text-[#94A3B8]" : "border-[#CBD5E1] text-[#334155]"}`}>Next</Link>
    </nav>
  );
}

function AgePill({ days }: { days: number }) {
  const tone = days >= 7 ? "border-red-200 bg-red-50 text-red-700" : days >= 3 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold tabular-nums ${tone}`}>{days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}</span>;
}

function StatusPill({ status }: { status: string }) {
  const complete = status === "approved";
  const attention = status === "changes_requested" || status === "rejected";
  const className = complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : attention ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${className}`}>{statusLabels[status] ?? status}</span>;
}

function queueHref(params: Record<string, string | null>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  if (page > 1) query.set("page", String(page));
  return `/customers/applications${query.size ? `?${query.toString()}` : ""}`;
}

function clean(value: string | undefined) {
  const output = value?.trim().slice(0, 100);
  return output || null;
}

function allowed<T extends string>(value: string | undefined, options: Set<T>) {
  return value && options.has(value as T) ? value as T : null;
}

function positiveInteger(value: string | undefined) {
  const number = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}
